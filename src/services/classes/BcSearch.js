import { binarySearchNumber } from '../../lib/utils'

export function BcSearch (nod3) {
  const getBlock = (hashOrNumber) => {
    return nod3.eth.getBlock(hashOrNumber)
  }

  const block = async (searchCb, highBlock, lowBlock) => {
    try {
      if (!highBlock) {
        let block = await getBlock('latest')
        let { number } = block
        highBlock = number
      }
      lowBlock = lowBlock || 1
      return binarySearchNumber(searchCb, highBlock, lowBlock)
    } catch (err) {
      return Promise.reject(err)
    }
  }

  const isContractAtBlock = async (address, blockNumber) => {
    let code = await nod3.eth.getCode(address, blockNumber)
    code = parseInt(code)
    return !isNaN(code) && code > 0
  }

  const contractDeployBlock = (address, highBlock, lowBlock) => {
    return block(blockNumber => isContractAtBlock(address, blockNumber), highBlock, lowBlock)
  }

  return Object.freeze({ block, contractDeployBlock })
}

export default BcSearch
