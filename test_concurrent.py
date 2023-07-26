import requests
import datetime
import concurrent.futures

RESET_ENDPOINT = 'https://7gujj5ffq9.execute-api.us-east-1.amazonaws.com/prod/reset-redis'
ENDPOINT = 'https://7gujj5ffq9.execute-api.us-east-1.amazonaws.com/prod/charge-request-redis'
MAX_THREADS = 4
DEFAULT_BALANCE = 1000
# Each call decrements balance by 5, so do enough to leave us with a balance of 5
CALLS = (DEFAULT_BALANCE // 5) - 1

def send_api_request(url, data = None):
    print ('Sending API request: ', url)
    r = requests.post(url, json=(data or {}))
    print ('Received: ', r.status_code, r.text)
    return r.json()

print ('Resetting balance')
send_api_request(RESET_ENDPOINT)

start_time = datetime.datetime.now()
print ('Starting:', start_time)

with concurrent.futures.ThreadPoolExecutor(MAX_THREADS) as executor:
    futures = [ executor.submit(lambda: send_api_request(ENDPOINT, {
        'unit': 1,
        'serviceType': 'voice',
    })) for x in range (CALLS) ]
    executor.shutdown(wait=True)

# We should have enough balance for a single voice call (5), or two text calls (4) with 1 left over
final_result = send_api_request(ENDPOINT, {'unit': 2, 'serviceType': 'text'})
print(f'Final result: {final_result}')
assert(final_result['isAuthorized'])
assert(final_result['remainingBalance'], 1)

# We have a balance of 1 - not enough for a single text or voice unit
# check for a denied result
denied_result = send_api_request(ENDPOINT, {'unit': 1, 'serviceType': 'text'})
print(f'Denied result: {denied_result}')
assert(denied_result['isAuthorized'] == False)
assert(denied_result['remainingBalance'] == 1)

end_time = datetime.datetime.now()
print ('Finished start time:', start_time, 'duration: ', end_time-start_time)
