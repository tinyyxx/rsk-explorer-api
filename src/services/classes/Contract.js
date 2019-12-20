import { BcThing } from './BcThing'
import ContractParser from 'rsk-contract-parser'
import { tokensInterfaces } from '../../lib/types'
import { hasValue } from '../../lib/utils'

/**
 * @description
 * @class Contract
 * @params:
 * 
 * @extends {BcThing}
 */
class Contract extends BcThing {
  constructor (address, createdBy, { abi, nod3, initConfig }) {
    super({ nod3, initConfig })
    let { log } = this
    if (!this.isAddress(address)) throw new Error(`Contract: invalid address ${address}`)
    this.parser = new ContractParser({ abi, log, initConfig, nod3 })
    this.creationData = creationData
    const createdByTx = (creationData && creationData.tx) ? creationData.tx : null
    this.data = {
      address,
      createdBy
    }
    this.contract = this.makeContract()
  }

  async fetch () {
    try {
      // new contracts
      if (this.creationData) {
        let txInputData = this.creationData.tx.input
        let info = await this.parser.getContractInfo(txInputData, this.contract)
        let { interfaces, methods } = info
        if (interfaces.length) this.data.contractInterfaces = interfaces
        if (methods) this.data.contractMethods = methods
        if (this.isToken(interfaces)) {
          let tokenData = await this.getTokenData()
          if (tokenData) this.data = Object.assign(this.data, tokenData)
        }
      }
      let data = this.getData()
      return data
    } catch (err) {
      return Promise.reject(err)
    }
  }

  makeContract () {
    return this.parser.makeContract(this.address)
  }

  getTokenData () {
    let { contractMethods } = this.data
    let methods = ['name', 'symbol', 'decimals', 'totalSupply']
    methods = methods.filter(m => contractMethods.includes(`${m}()`))
    return this.parser.getTokenData(this.contract, { methods })
  }

  call (method, params = []) {
    const contract = this.contract
    return this.parser.call(method, contract, params)
  }

  isToken (interfaces) {
    return hasValue(interfaces, tokensInterfaces)
  }
  getCode () {

  }
  getDeployedBytecode () {
    // get bytecode from tx.input || iTx
  }
}
export default Contract
