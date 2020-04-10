import { expect } from 'chai'
import nod3 from '../src/lib/nod3Connect'
import BcSearch from '../src/services/classes/BcSearch'

let search = BcSearch(nod3)

describe('BC search', function () {

  it('should be connected to RSK testnet', async function () {
    let net = await nod3.net.version()
    expect(net.id).to.be.equal('31')
  })

  describe('contractDeployBlock()', function () {
    this.timeout(90000)
    let tests = [['0x4f82e59517c29ed0c73f5351847eb075bf473465', 657077]]
    for (let [address, block] of tests) {
      it(`${address} should return ${block} `, async () => {
        let res = await search.contractDeployBlock(address)
        expect(res).to.be.equal(block)
      })
    }
  })
})
