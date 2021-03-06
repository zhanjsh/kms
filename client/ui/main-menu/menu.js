/**
 * Main app menu
 */
import Util from '../../../core/util'

export default function Self (p) {
  this.p = p || {}

  this.selectors = {
    input: 'input',
  }
  this._menuItems = [
    {
      title: 'Blog',
      url: 'http://dmitra.com/graphiy',
    }, {
      title: 'Documentation on Wiki',
      url: 'http://github.com/Graphiy/kms/wiki',
    }, {
      title: 'Vote for features',
      url: 'https://trello.com/b/W1Zvc6Pn/kms',
    }, {
      title: 'File an issue',
      url: 'http://github.com/Graphiy/kms/issues',
    }, {
      title: 'Open source on Github',
      url: 'http://github.com/Graphiy/kms',
    }, {
      title: 'GraphiTabs',
      url: '/graphitabs.html',
    },
  ]
  const $html = $(G.Templates['ui/main-menu/menu']({ items: this._menuItems }))
  this.p.container.append($html)
  this.elements = Util.findElements($html, this.selectors)
}
