const stellar = require('@stellar/stellar-sdk');
console.log('rpc property:', !!stellar.rpc);
if (stellar.rpc) {
  console.log('rpc keys:', Object.keys(stellar.rpc));
}
