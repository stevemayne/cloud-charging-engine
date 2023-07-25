local balance = redis.call('get', KEYS[1])
if balance == false then
    return {'false', 0}
end
local balance = tonumber(balance)
local charges = tonumber(ARGV[1])
if balance >= charges then
    balance = balance - charges
    redis.call('set', KEYS[1], balance)
    return {'true', balance}
else
    return {'false', balance}
end
