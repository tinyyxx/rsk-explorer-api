'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _web = require('web3');

var _web2 = _interopRequireDefault(_web);

var _web3Connect = require('../../lib/web3Connect');

var _web3Connect2 = _interopRequireDefault(_web3Connect);

var _Db = require('../../lib/Db');

var dataBase = _interopRequireWildcard(_Db);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const blocksCollections = {
  blocksCollection: [{
    key: { number: 1 },
    unique: true
  }],
  txCollection: [{
    key: { hash: 1 },
    unique: true
  }, {
    key: {
      blockNumber: 1,
      transactionIndex: 1
    },
    name: 'blockTrasaction'
  }, {
    key: { from: 1 },
    name: 'fromIndex'
  }, {
    key: { to: 1 },
    name: 'toIndex'
  }],
  accountsCollection: [{
    key: { address: 1 },
    unique: true
  }]
};

function blocks(config, db) {
  let queue = [];
  let log = config.Logger || console;
  for (let c in blocksCollections) {
    let name = config[c] || c;
    queue.push(dataBase.createCollection(db, name, blocksCollections[c]));
  }
  return Promise.all(queue).then(collections => {
    return new SaveBlocks(config, ...collections);
  }).catch(err => {
    log.error('Error creating collections');
    log.error(err);
    process.exit(9);
  });
}
class SaveBlocks {
  constructor(options, blocksCollection, txCollection, accountsCollection, statsCollection) {
    this.node = options.node;
    this.port = options.port;
    this.Blocks = blocksCollection;
    this.Txs = txCollection;
    this.Stats = statsCollection;
    this.Accounts = accountsCollection;
    this.web3 = (0, _web3Connect2.default)(options.node, options.port);
    this.requestingBlocks = {};
    this.blocksQueueSize = options.blocksQueueSize || 30; // max blocks per queue
    this.blocksQueue = -1;
    this.log = options.Logger || console;
  }

  checkDB() {
    this.log.info('checkig db');
    return this.getBlockAndSave('latest').then(blockData => {
      return this.checkDbBlocks().then(missingBlocks => {
        this.blocksQueue = missingBlocks;
        return this.processAllQueues();
      });
    }).catch(err => {
      this.log.error('Error getting latest block: ' + err);
      process.exit();
    });
  }

  listenBlocks() {
    this.log.info('Listen to blocks...');
    this.web3.reset();
    let filter = this.web3.eth.filter({ fromBlock: 'latest', toBlock: 'latest' });
    filter.watch((error, log) => {
      if (error) {
        this.log.error('Filter Watch Error: ' + error);
      } else if (log === null) {
        this.log.warn('Warning: null block hash');
      } else {
        let blockNumber = log.blockNumber || null;
        if (blockNumber) {
          this.log.debug('New Block:', blockNumber);
          this.getBlocksFrom(blockNumber);
        } else {
          this.log.warn('Error, log.blockNumber is empty');
        }
      }
    });
  }
  processAllQueues() {
    return new Promise((resolve, reject) => {
      let pending = this.processQueue();
      if (pending) {
        Promise.all(pending).then(values => {
          this.processAllQueues();
        }, reason => {
          this.log.error(reason);
          this.checkAndListen();
        });
      } else {
        resolve();
      }
    });
  }
  processQueue() {
    if (this.blocksQueue > -1) {
      let pending = [];
      for (let i = 0; i < this.blocksQueueSize; i++) {
        pending.push(this.getBlockIfNotExistsInDb(this.blocksQueue));
        this.blocksQueue--;
      }
      return pending;
    }
  }

  async checkDbBlocks() {
    let lastBlock = await this.getHighDbBlock();
    let dbBlocks = await this.countDbBlocks();
    return lastBlock.number > dbBlocks ? lastBlock.number : null;
  }
  checkBlock(blockNumber) {
    return this.Blocks.findOne({ number: blockNumber }).then(doc => {
      return doc;
    });
  }
  getBlockIfNotExistsInDb(blockNumber) {
    return this.checkBlock(blockNumber).then(block => {
      if (!block) {
        this.log.debug('Missing block ' + blockNumber);
        return this.getBlockAndSave(blockNumber);
      }
    });
  }
  getHighDbBlock() {
    return this.Blocks.findOne({}, { sort: { number: -1 } });
  }
  countDbBlocks() {
    return this.Blocks.count({});
  }
  getBlockAndSave(blockNumber) {
    return new Promise((resolve, reject) => {
      if (!blockNumber && blockNumber !== 0) reject('blockHashOrNumber is:' + blockNumber);

      if (this.web3.isConnected()) {
        if (!this.requestingBlocks[blockNumber]) {
          this.log.debug('Getting Block: ', blockNumber);
          this.requestingBlocks[blockNumber] = true;
          this.web3.eth.getBlock(blockNumber, true, (err, blockData) => {
            if (err) {
              reject('Warning: error on getting block with hash/number: ' + blockNumber + ': ' + err);
            } else {
              if (!blockData) {
                reject('Warning: null block data received from ' + blockNumber);
              } else {
                this.log.debug('New Block Data', blockData.number, blockData.timestamp);
                delete this.requestingBlocks[blockData.number];
                resolve(this.writeBlockToDB(blockData));
              }
            }
          });
        }
      }
    }).catch(err => {
      this.requestingBlocks[blockNumber] = false;
      this.log.error(err);
      this.start();
    });
  }

  extractTransactionsAccounts(transactions) {
    let accounts = [];
    for (let tx of transactions) {
      accounts.push(this.accountDoc(tx.from));
      accounts.push(this.accountDoc(tx.to));
    }
    return accounts;
  }
  accountDoc(address) {
    return { address, balance: 0 };
  }

  getBlockTransactions(blockData) {
    let transactions = blockData.transactions;
    if (transactions) {
      transactions = transactions.map(item => {
        item.timestamp = blockData.timestamp;
        return item;
      });
    }
    return transactions;
  }

  insertBlock(blockData) {
    return this.Blocks.insertOne(blockData);
  }

  insertAccounts(accounts) {
    for (let account of accounts) {
      this.Accounts.insertOne(account).then(res => {
        this.log.info(this.dbInsertMsg(res, accounts, 'accounts'));
      }).catch(err => {
        // hide duplicate accounts log 
        if (err.code !== 11000) console.log('Errror inserting account ' + err);
      });
    }
  }

  writeBlockToDB(blockData) {
    return new Promise((resolve, reject) => {
      if (!blockData) reject('no blockdata');
      blockData._received = Date.now();
      let transactions = this.getBlockTransactions(blockData);
      delete blockData.transactions;
      blockData.txs = transactions.length;
      let accounts = this.extractTransactionsAccounts(transactions);
      // insert block
      this.Blocks.insertOne(blockData).then(res => {
        this.log.info('Inserted Block ' + blockData.number);

        // insert transactions
        if (transactions.length) {
          this.Txs.insertMany(transactions).then(res => {
            this.log.debug(this.dbInsertMsg(res, transactions, 'transactions'));
            resolve(blockData);
          }).catch(err => {
            // insert txs error
            this.log.error('Error inserting txs ' + err);
          });
        }

        // insert accounts
        this.insertAccounts(accounts);
      }).catch(err => {
        // insert block error
        if (err.code === 11000) {
          this.log.debug('Skip: Duplicate key ' + blockData.number.toString());
          resolve(blockData);
        } else {
          this.log.error('Error: Aborted due to error on ' + 'block number ' + blockData.number.toString() + ': ' + err);
          process.exit(9);
        }
      });
    });
  }
  getBlocksFrom(blockNumber) {
    if (this.requestingBlocks[blockNumber]) blockNumber--;
    this.log.debug('Getting block from ', blockNumber);
    this.checkBlock(blockNumber).then(block => {
      if (!block) {
        this.getBlockAndSave(blockNumber);
        blockNumber--;
        this.getBlocksFrom(blockNumber);
      }
    });
  }
  start() {
    if (this.web3 && this.web3.isConnected()) {
      // node is syncing
      if (this.web3.syncing) {
        this.web3.eth.isSyncing((err, sync) => {
          if (!err) {
            if (sync === true) {
              this.web3.reset(true);
              this.checkDB();
            } else if (sync) {
              let block = sync.currentBlock;
              this.getBlocksFrom(block);
            } else {
              this.checkAndListen();
            }
          } else {
            this.log.error('syncing error', err);
          }
        });
      } else {
        // node is not syncing
        this.checkAndListen();
      }
    } else {
      this.log.warn('Web3 is not connected!');
      this.start();
    }
  }

  checkAndListen() {
    this.checkDB();
    this.listenBlocks();
  }
  dbInsertMsg(insertResult, data, dataType) {
    let count = data ? data.length : null;
    let msg = ['Inserted', insertResult.result.n];
    if (count) {
      msg.push('of');
      msg.push(count);
    }
    if (dataType) msg.push(dataType);
    return msg.join(' ');
  }
}

exports.default = blocks;