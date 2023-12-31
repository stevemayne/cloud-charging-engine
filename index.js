"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis = require("redis");
const fs = require("fs");
const util = require("util");

const KEY = `account1/balance`;
const DEFAULT_BALANCE = 1000;
const VOICE_UNIT_CHARGE = 5;
const TEXT_UNIT_CHARGE = 2;
const SERVICE_TYPE_VOICE = 'voice';
const SERVICE_TYPE_TEXT = 'text';
const SAFE_DECR_SCRIPT = fs.readFileSync('./lua/safe_decr.lua', 'utf8');

let _redis = null;

exports.chargeRequestRedis = async function (input, reconnect = true) {
    const redisClient = await getRedisClient();
    try {
        const charges = getCharges(input.serviceType, input.unit);
        const evalAsync = util.promisify(redisClient.eval).bind(redisClient);
        let result = await evalAsync(SAFE_DECR_SCRIPT, 1, KEY, charges);
        console.log(result);
        return {
            'remainingBalance': result[1],
            'isAuthorized': result[0] == 'true',
            charges: charges
        };
    } catch (error) {
        console.log(error);
        if (reconnect && (error instanceof SocketClosedUnexpectedlyError)) {
            resetRedisClient();
            return await chargeRequestRedis(input, reconnect = false);
        }
        throw error;
    }
};
exports.resetRedis = async function () {
    const redisClient = await getRedisClient();
    const ret = new Promise((resolve, reject) => {
        redisClient.set(KEY, String(DEFAULT_BALANCE), (err, res) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(DEFAULT_BALANCE);
            }
        });
    });
    return ret;
};
function resetRedisClient() {
    _redis = null;
}
async function getRedisClient() {
    if (_redis == null) {
        _redis = new Promise((resolve, reject) => {
            try {
                const client = new redis.RedisClient({
                    host: process.env.ENDPOINT,
                    port: parseInt(process.env.PORT || "6379"),
                });
                client.on("ready", () => {
                    console.log('redis client ready');
                    resolve(client);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    return _redis;
}
function getCharges(serviceType, unit) {
    if (serviceType == SERVICE_TYPE_VOICE) {
        return VOICE_UNIT_CHARGE * unit;
    }
    if (serviceType == SERVICE_TYPE_TEXT) {
        return TEXT_UNIT_CHARGE * unit;
    }
    throw new Error('unknown service type');
}
