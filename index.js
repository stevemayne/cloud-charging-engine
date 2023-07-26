"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis = require("redis");
const fs = require("fs");
const util = require("util");
const KEY = `account1/balance`;
const DEFAULT_BALANCE = 1000;
const SAFE_DECR_SCRIPT = fs.readFileSync('./lua/safe_decr.lua', 'utf8');

exports.chargeRequestRedis = async function (input) {
    const redisClient = await getRedisClient();
    const charges = getCharges(input.amount, input.unit);
    const evalAsync = util.promisify(redisClient.eval).bind(redisClient);
    let result = await evalAsync(SAFE_DECR_SCRIPT, 1, KEY, charges);
    console.log(result);
    await disconnectRedis(redisClient);
    return {
        'remainingBalance': result[1],
        'isAuthorized': result[0] == 'true',
        charges: charges
    };
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
    await disconnectRedis(redisClient);
    return ret;
};
async function getRedisClient() {
    return new Promise((resolve, reject) => {
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
async function disconnectRedis(client) {
    return new Promise((resolve, reject) => {
        client.quit((error, res) => {
            if (error) {
                reject(error);
            }
            else if (res == "OK") {
                console.log('redis client disconnected');
                resolve(res);
            }
            else {
                reject("unknown error closing redis connection.");
            }
        });
    });
}
function getCharges(serviceType, unit) {
    if (serviceType == 'voice') {
        return VOICE_UNIT_CHARGE * unit;
    }
    if (serviceType == 'text') {
        return TEXT_UNIT_CHARGE * unit;
    }
    throw new Error('unknown service type');
}
