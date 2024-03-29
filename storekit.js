const axios = require('axios');
const jp = require('jsonpath');
const jwt = require('./util/jwt');

function StoreKit(config) {
    this.baseURL = config.baseURL || 'https://api.storekit-sandbox.itunes.apple.com/inApps/v1';
    this.issuer = config.issuer;
    this.bid = config.bid;
    this.kid = config.kid;
    this.privateKey = config.privateKey;

    this.axios = axios.create({ baseURL: this.baseURL });
    this.updateToken();
}

StoreKit.prototype.updateToken = function updateToken() {
    const token = jwt.generateToken(this.issuer, this.bid, this.kid, this.privateKey);
    this.axios.defaults.headers.common.Authorization = token;
};

StoreKit.prototype.subscriptions = async function subscriptions(originalTransactionId) {
    if (originalTransactionId === undefined) {
        return undefined;
    }

    const response = await this.axios.get(`/subscriptions/${originalTransactionId}`);
    jp.apply(response, '$.data.data[*].lastTransactions[*].signedTransactionInfo', (value) => jwt.verifyToken(value));
    jp.apply(response, '$.data.data[*].lastTransactions[*].signedRenewalInfo', (value) => jwt.verifyToken(value));
    return response.data;
};

StoreKit.prototype.history = async function history(originalTransactionId) {
    if (originalTransactionId === undefined) {
        return undefined;
    }

    const response = await this.axios.get(`/history/${originalTransactionId}`);
    jp.apply(response, '$.data.signedTransactions[*]', (value) => jwt.verifyToken(value));
    return response.data;
};

StoreKit.prototype.invoice = async function invoice(orderId) {
    if (orderId === undefined) {
        return undefined;
    }

    const response = await this.axios.get(`/lookup/${orderId}`);
    jp.apply(response, '$.data.signedTransactions[*]', (value) => jwt.verifyToken(value));
    return response.data;
};

StoreKit.prototype.decodeNotification = function decodeNotification(signedPayload) {
    const decodedPayload = jwt.verifyToken(signedPayload);
    jp.apply(decodedPayload, '$.data.signedTransactionInfo', (signedTransactionInfo) =>
        jwt.verifyToken(signedTransactionInfo)
    );
    jp.apply(decodedPayload, '$.data.signedRenewalInfo', (signedRenewalInfo) => jwt.verifyToken(signedRenewalInfo));
    return decodedPayload;
};

StoreKit.prototype.notifications = async function notifications(paginationToken, params = {}) {
    const response = await this.axios.post(
        `/notifications/history${paginationToken ? `?paginationToken=${paginationToken}` : ''}`,
        params,
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
    jp.apply(response, '$.data.notificationHistory[*].signedPayload', (signedPayload) =>
        this.decodeNotification(signedPayload)
    );
    return response.data;
};

module.exports = StoreKit;
