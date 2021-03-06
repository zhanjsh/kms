/**
 * Client application is run in browser
 */
import co from 'co'
import Util from '../core/util'
import ClientUtil from './util' //eslint-disable-line
import Provider from '../provider/api.client/index'
import Collection from '../core/collection'
import UI from './ui/ui'
import Graph from '../provider/graph/index'

class Self {
  constructor () {
    this.rootKey = '00000000-0000-4000-8000-000000000000'
    this._itemtypes = ['tag', 'note']
    this._serviceItems = ['root', 'visibleItem', 'itemtype']
    this.serviceItem = {}

    this.selection = new Collection()

    // IDs array of visible items
    this.visibleItems = new Collection()
    const providerSet = {
      url: '/item',
    }
    this.provider = new Provider(providerSet)

    this.selection.on('change', this._onSelect.bind(this))
    this.ui = new UI({ itemman: this, selection: this.selection })
    this.ui.search.on('update', this._onSearch.bind(this))

    co(this._loadRepo())
  }

  showChildren (keyS) {
    const keys = Util.pluralize(keyS)

    // TODO multiple
    const rootKey = keys[0]
    this.provider.request('getGraph', rootKey, 1)
      .then(graph => {
        graph.remove(rootKey)
        this._filter(graph)
        const linkedKeys = graph.getItemKeys()
        this.visibleItems.add(linkedKeys)

        this.ui.linkedList.show()

        // TODO when one view on common container is changed fire event and resize others
        this.ui.linkedList.render(graph.getItemsMap())
      })
  }

  createItem () {
    const selected = this.selection.getAll()
    let updatesCounter = selected.length
    this.provider.request('set')
      .then(key => {
        if (!_.isEmpty(selected)) {
          _.each(selected, (relatedKey) => {
            this.provider.request('associate', key, relatedKey)
              .then(updated => {
                --updatesCounter
                if (updatesCounter === 0) this.visibleItems.add(key)
              })
          })
        } else {
          this.visibleItems.add(key)
          this.selection.add(key)
        }
      })
  }

  editItem (key) {
    this.provider.request('get', key)
      .then(value => {
        this.ui.editor.set(value, key)
        this.ui.editor.show()
      })
  }

  saveItem (value, key) {
    this.provider.request('set', value, key)
      .then(_key => {
        if (_key === key) {
          this.ui.editor.saved()
          this._reloadGraph()
        }
      })
  }

  removeItem (keys) {
    this.provider.request('remove', keys)
      .then(updated => {
        this.visibleItems.remove(keys)
      })
  }

  linkItems (source, targets) {
    this.provider.request('associate', source, targets)
      .then(updated => {
        this._reloadGraph()
      })
  }

  unlinkItems (source, targets) {
    this.provider.request('setDisassociate', source, targets)
      .then(updated => {
        this._reloadGraph()
      })
  }

  visibleLinked (parent) {
    return this._graph.getLinked(parent)
  }
  /**
   * Populate view with user data from previous time
   */
  *_loadRepo () {
    let graph = yield this.provider.request('getGraph', this.rootKey, 1)
    if (_.isEmpty(graph.getItemsMap())) yield this._initRepo()
    else {
      _.each(this._serviceItems.concat(this._itemtypes), (item) => {
        this.serviceItem[item] = graph.search(this.rootKey, item)[0]
      })
      this.serviceItem.root = this.rootKey
    }

    graph = yield this.provider.request('getGraph', this.serviceItem.visibleItem, 1)
    this._filter(graph)
    const keys = graph.getItemKeys()
    this.visibleItems.add(keys)
    this._updateGraphView(graph)
    this.visibleItems.on('change', this._reloadGraph.bind(this))
    this.visibleItems.on('add', this._onVisibleItemsAdd.bind(this))
    this.visibleItems.on('remove', this._onVisibleItemsRemove.bind(this))
  }

  _initRepo () {
    const graph = new Graph
    graph.set('root', this.rootKey)
    _.each(this._serviceItems.concat(this._itemtypes), (item) => {
      if (item === 'root') return
      this.serviceItem[item] = graph.set(item)
      graph.associate(this.rootKey, this.serviceItem[item])
      if (this._itemtypes.includes(item)) {
        graph.associate(this.serviceItem.itemtype, this.serviceItem[item])
      }
    })
    return this.provider.request('merge', graph)
  }

  _onSelect () {
    const keys = this.selection.getAll()
    if (keys.length === 1) {
      const key = keys[0]
      if (this.ui.editor.isVisible()) {
        // TODO make local _graph.get and retrieve value only for partially loaded items
        this.provider.request('get', key)
          .then(value => {
            this.ui.editor.set(value, key)
          })
      }
    } else if (keys.length === 0) this.ui.hideSecondaryViews()
  }

  _onSearch (data) {
    this.provider.request('find', data.str, data.flags)
      .then(keys => {
        this.visibleItems.add(keys)
      })
  }

  _onVisibleItemsRemove (keys) {
    this.selection.remove(keys)
    this.provider.request('setDisassociate', this.serviceItem.visibleItem, keys)
  }
  /**
   * Store visible item
   */
  _onVisibleItemsAdd (keys) {
    this.provider.request('associate', this.serviceItem.visibleItem, keys)
  }
  /**
   * Sync graph with server
   */
  _reloadGraph () {
    const keys = this.visibleItems.getAll()
    this.provider.request('getGraph', keys)
      .then(graph => {
        this._updateGraphView(graph)
      })
  }

  _updateGraphView (graph) {
    this._graph = graph
    this.ui.graphView.render(graph)
  }

  _filter (data) {
    let graph
    let keys
    const serviceKeys = _.toArray(this.serviceItem)
    if (data.providerID) graph = data
    if (_.isArray(data)) keys = data
    if (graph) {
      graph.remove(serviceKeys)
      return graph
    }
    return _.without(keys, serviceKeys)
  }
}

const templates = G.Templates
G = new Self()
G.Templates = templates
