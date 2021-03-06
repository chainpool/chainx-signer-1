import { stringCamelCase } from '@chainx/util'
const { Extrinsic: OriginExtrinsic } = require('@chainx/types')

export class Extrinsic extends OriginExtrinsic {
  get methodName() {
    return this.meta.get('name').toString()
  }

  get argsArr() {
    const args = []

    const entries = this.method.get('args').entries()
    for (let [name, value] of entries) {
      args.push({ name, value })
    }

    return args
  }
}

export const parseData = data => {
  const ex = new Extrinsic(data)
  return [
    stringCamelCase(ex.methodName),
    ex.argsArr.map(item =>
      ex.methodName === 'put_code' ? item.value : item.value.toString()
    ),
    ex.argsArr
  ]
}
