/**
 * Graph provider - In memory Associative storage
 *
 * Basic module which is used by many others as operational in-memory (temporary) storage
 * Links are stored in redundant format: each item's key has array of its links
 * Link is an array of key and weight
 * Binary Items are only referenced by path
 */
var _ = require('lodash')
, dijkstra = require('../../core/dijkstra')

var Self = function (obj) {
  var self = this
  obj = obj || {}
  self._items = _.extend({}, obj.items)
  self._links = _.extend({}, obj.links)
}
/**
 * Doesn't allow override except if key is specified exactly
 * @param {String|Array} data values of items to be set
 * @param Key key of the item to set data to
 * @return Key ID for existing item if any
 */
Self.prototype.set = function (data, key) {
  var self = this
  if (_.isArray(data)) return _.map(data, function (datum) { return self.set(datum) })

  if (!data) {
    key = key || generateID()
    //Ensure value is not undefined, as JSON stringify will omit it
    data = ''
  } else {
    key = key || self.getKey(data) || generateID()
  }
  self._items[key] = data
  return key
}
/**
 * remove key, value, its links and its key from all item which links to it
 */
Self.prototype.remove = function (key) {
  var self = this
  var linkedKeys = self.getLinked(key)
  _.each(linkedKeys, function (linkedKey) {
    self.setDisassociate(key, linkedKey)
  })
  delete self._items[key]
  delete self._links[key]

  return _.union([key], linkedKeys)
}
/**
 * Merge this with provided graph
 * links are summed
 * @param Graph graph
 * @param Boolean p.overwrite existing items values with provided
 */
Self.prototype.merge = function (graph, p) {
  var self = this
  p = p || {}
  var newItems = graph.getItemsMap()

  _.each(newItems, function (value, key) {
    if (self._items[key] && !p.overwrite) return
    self._items[key] = value
  })

  //_.each(newItems, function (newItem) {
    //var existLinked = self.getLinked(newItem)
    //var newLinked = graph.getLinked(newItem)
    //var addLinked = _.difference(newLinked, existLinked)
    //if (p.overwrite) self.links[newItem]
  //})

  //walk through all items with links
  _.each(graph.getLinksMap(), function (newLinks, newItemWithLinksKey) {
    var existLinks = self._links[newItemWithLinksKey]
    if (!existLinks) return self._links[newItemWithLinksKey] = newLinks
    _.each(newLinks, function (newLink) {
      var existLink = _.find(existLinks, function (existingLink) { return existingLink[0] === newLink[0]})
      if (existLink && !p.overwrite) return
      if (existLink) existLink[1] = newLink[1]
      existLinks.push(newLink)
    })
  })
}
/**
 * DEPRECATED
 * Create Group Item and link with children
 * @param String groupValue
 * @param data Array values of items to be connected to the group item
 */
Self.prototype.setGroup = function (groupValue, data) {
  var self = this
  var noData = !data || _.isEmpty(data)
  if (!groupValue && noData) throw 'empty item with no links'
  if (noData) return self.set(groupValue)

  var key = self.set(groupValue)
  var groupKeys = _.map(data, function (datum) { return self.set(datum) })
  self.associateGroup(key, groupKeys)
  
  return key
}
/**
 * @param Key Item ID
 * @return String Item data
 */
Self.prototype.get = function (key) {
  var self = this
  return self._items[key]
}
/**
 * @return Object all stored items
 */
Self.prototype.getItemsMap = function () {
  return this._items
}
/**
 * @return Array of keys
 */
Self.prototype.getItemKeys = function () {
  return _.keys(this._items)
}
/**
 * Get key of item by value
 * do not return anything by empty value
 * @param String data of Item
 * @return Key of Item
 */
Self.prototype.getKey = function (value) {
  var self = this
  if (!value) return
  value = value.toString()
  
  return _.invert(self._items)[value]
}
/**
 * DEPRECATED
 * @param String data
 * @return Key of Item with group meaning
 */
Self.prototype.findGroup = function (data) {
  var self = this
  if (!_.isArray(data)) throw 'Group can be found by multiple values only'
  var keys = _.map(data, function (datum) {
    return self.getKey(datum)
  })
  return self.getKey(keys)
}
/**
 * Create link between two Items
 * @param Key Item ID
 * @param Key Item ID
 * @param Number weight for this link to be increased on
 */
Self.prototype.associate = function (key1, key2, weight) {
  var self = this
  if (!self.validateKeys(key1, key2)) return []
     
  var linkedTo1 = self._links[key1]
  , linkedTo2 = self._links[key2]
  , skip
  weight = weight || 0
  if (!_.isInteger(weight)) weight = 0

  if (!linkedTo1) linkedTo1 = self._links[key1] = []
  if (!linkedTo2) linkedTo2 = self._links[key2] = []

  // check if link exists and increment weight if it does
  linkedTo1.forEach(function (link) {
    if (link && link[0] === key2){
      link[1] = (link[1] || 0) + (weight || 1)
      return skip = true
    }
  })
  // write new links
  if (!skip) {
    linkedTo1.push([key2, weight])
    linkedTo2.push([key1, weight])
  }
  linkedTo1.sort(compareWeight)
  linkedTo2.sort(compareWeight)
  return [key1, key2]
}
/**
 * unlink items
 */
Self.prototype.setDisassociate = function (key1, key2) {
  var self = this
  if (!self.validateKeys(key1, key2)) return []
  self._links[key1] = _.filter(self._links[key1], function (link) { return link[0] !== key2 })
  self._links[key2] = _.filter(self._links[key2], function (link) { return link[0] !== key1 })
  return [key1, key2]
}
/**
 * Associate one item to array of items
 */
Self.prototype.associateGroup = function (key1, keys) {
  var self = this
  var changed = _.map(keys, function (key) {
    return self.associate(key1, key)
  })
  return _.uniq(_.flatten(changed))
}
/**
 * @param {String|Array} key1
 * @param {String|Array} key2
 * @return Number weight of the link
 */
Self.prototype.getLink = function (key1, key2) {
  var self = this
  if (!self.validateKeys(key1, key2)) return
  var linkedTo1 = self._links[key1]
  for (var i = 0; i < linkedTo1.length; i++) {
    if (linkedTo1[i] && linkedTo1[i][0] === key2) return linkedTo1[i][1] || 0
  }
}
/**
 * @return Object in format {a:[[b, 3], [c, 1]], b:[[a, 2], [c,1]], c:[[a,4],[b,1]]}
 */
Self.prototype.getLinksMap = function () {
  return this._links
}
/**
 * @return Object in format {a:{b:3,c:1},b:{a:2,c:1},c:{a:4,b:1}}
 */
Self.prototype.getLinksWeightMap = function () {
  var self = this
  var map = {}
  _.each(self._links, function (links, key) {
    map[key] = {}
    _.each(links, function (link) {
      map[key][link[0]] = link[1]
    })
  })
  return map
}
/**
 * @return Array of Links
 */
Self.prototype.getLinksArray = function () {
  var self = this
  var completed = {}
  var all = []
  _.each(self._links, function (linked, key1) {
    linked.forEach(function (link) {
      var key2 = link[0]
      if (!completed[key1] && !completed[key2]) all.push([key1, key2])
    })
    completed[key1] = true
  })
  return all
}
/**
 * @param Key Item key
 * @return Array of links of provided Item
 */
Self.prototype.getLinks = function (key) {
  var self = this
  return self._links[key] || []
}
/**
 * @param {String|Array} key Item(s) key
 * @return Array of distinct Items linked with specified Item(s)
 */
Self.prototype.getLinked = function (key) {
  var self = this
  return _.map(self.getLinks(key), function (link) {
    return link[0]
  })
}
/**
 * TODO works only for depth 0/1
 * @param rootKey Key of item to traverse graph from
 * @param depth
 * @return Graph starting from the item provided
 */
Self.prototype.getGraph = function (rootKey, depth) {
  var self = this
  depth = depth || 0
  var sgItems = {} //sub graph items
  var sgLinks = {}
  sgItems[rootKey] = self.get(rootKey)
  sgLinks[rootKey] = self._links[rootKey]

  if (depth == 1) {
    _.each(sgLinks[rootKey], function (link) {
      sgItems[link[0]] = self.get(link[0])
    })
    //add links in between those retrieved
    _.each(sgItems, function (value, sgItemKey) {
      if (sgItemKey === rootKey) return // skip

      var allSgItemLinks = self._links[sgItemKey]
      var filteredSgItemLinks = _.filter(allSgItemLinks, function (link) {
        return !!sgItems[link[0]]
      })
      sgLinks[sgItemKey] = filteredSgItemLinks
    })
  }

  return new Self({items: sgItems, links: sgLinks})
}
/**
 * Find items linked with specified
 * @param {String|Array} Keys of items connected to the item looked for
 */
Self.prototype.findByKeys = function (keys) {
  var self = this
  if (!_.isArray(keys)) keys = [keys]

  var arrLinkedKeys = _.map(keys, function (key) {
    return self.getLinked(key)
  })
  return _.intersection.apply(_, arrLinkedKeys)
}
/** convenient way to find by values
 * @param {String|Array} values of items connected to the item looked for
 */
Self.prototype.findByValues = function (values) {
  var self = this
  if (!_.isArray(values)) values = [values]

  var keys = _.map(values, function (value) {
    return self.getKey(value)
  })
  return self.findByKeys(keys)
}
//find by values or keys
Self.prototype.findByLinks = function (data) {
  var self = this
  if (!_.isArray(data)) data = [data]

  var keys = _.map(data, function (datum) {
    return datum.match(idPattern) ? datum : self.getKey(datum)
  })
  return self.findByKeys(keys)
}
/**
 * Find item with value matching the string
 * @param String value should be RegExp, but it cannot be stringified to transfer with JSON
 * @return Graph of Items
 */
Self.prototype.findGraph = function (lookupValue, p) {
  var self = this

  var existing = self.getKey(lookupValue)
  if (existing) return self.getGraph(existing, 1)
   
  var subGraph = new Self
  var target = subGraph.set(lookupValue)
  var regExp = new RegExp(lookupValue, p)
  _.each(self._items, function (value, key) {
    if (value.match(regExp) && value !== lookupValue) {
      subGraph.set(value, key)
      subGraph.associate(target, key)
    }
  })
  return subGraph
}
/**
 * Utilize dijkstra algorythm
 */
Self.prototype.findShortestPath = function (key1, key2) {
  var self = this
  var map = self.getLinksWeightMap()
  return dijkstra.findShortestPath(map, key1, key2)
}
/**
 * @param Function filterer
 * @return Object.Provider new
 */
Self.prototype.filter = function (filterer) {
  var self = this
  var filteredStorage = new Self()
  var items = filteredStorage._items = filterKeys(self._items, filterer)
  var fLinks = filteredStorage._links
  _.each(self._links, function (links, key) {
    if (items[key]) fLinks[key] = _.filter(links, function (link) {
      if (items[link[0]]) return link
    })
  })
  return filteredStorage
}
/**
 * @param Function func to be called with arguments (values instead of keys)
 */
Self.prototype.guess = function (func) {
  var self = this
  var args = Array.prototype.slice.call(arguments, 1)
  var keys = _.map(args, function (arg) {
    return self.getKey(arg)
  })
  var result = func.apply(self, keys)
  return self.log(result)
}
/**
 * convert IDs of the object into its values
 */
Self.prototype.log = function (obj) {
  var self = this
  var str = JSON.stringify(obj)
  str = self._replaceIds(str)
  console.log(str)
  return JSON.parse(str)
}

Self.prototype.toJSON = function () {
  return {items: this._items, links: this._links}
}

Self.prototype._replaceIds = function (str) {
  var self = this
  var recurse = false

  var ids = str.match(idPattern)
  ids.forEach(function (id) {
    var value = self.get(id) || id
    if (_.isArray(value)) recurse = true
    str = str.replace(id, value)
  })
  return recurse ? self._replaceIds(str) : str
}
/**
 * do not allow self reference
 */
Self.prototype.validateKeys = function (key1, key2) {
  var self = this
  return key1 && key2 && key1 !== key2 && self.get(key1) && self.get(key2)
}
function filterKeys(obj, filter) {
  var filtered = {}
  var keys = []
  _.each( obj, function (value, key) {
    if (filter(value)) {
      filtered[key] = value
    }
  })
  return filtered
}
//Compare two Links
function compareWeight(link1, link2) {
  return link1[1] > link2[1] ? 1 : -1
}
//generate random UUID
function generateID(a) {return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,generateID)}

var idPattern = /[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/g

module.exports = Self
