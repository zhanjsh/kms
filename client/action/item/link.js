import Action from '../../action'

export default class Self extends Action {
  constructor (p) {
    super(p)
    this._id = 'itemLink'
    this._label = 'Link'
    this._icon = 'mdi mdi-link-variant'
    this.group = 'item'

    this.registrar.selection.on('change', this.evaluate.bind(this, this.registrar.selection))
  }

  _execute (_target) {
    const target = _.isString(_target) ? _target : undefined
    const keys = this.registrar.selection.getAll()
    if (target && keys.length > 0) this.registrar.linkItems(target, keys)
    else if (keys.length === 2) this.registrar.linkItems(keys[0], keys[1])
  }

  evaluate (selection) {
    super._evaluate(selection.getCount())
  }
}
