import requests
import time
import re

start = time.time()
try:
    r = requests.post('http://127.0.0.1:8000/api/auth/send-otp', json={'identifier': 'mayurdoiphode55@gmail.com'})
    print(f'TIME: {time.time()-start:.2f}s')
    print('STATUS:', r.status_code)
    
    with open('error_traceback.html', 'w', encoding='utf-8') as f:
        f.write(r.text)
        
    title_match = re.search(r'<div class="exc-title">(.*?)</div>', r.text, re.DOTALL)
    if title_match:
        print('EXCEPTION TITLE:', title_match.group(1).strip().replace('\n', ' '))
        
    message_match = re.search(r'<div class="exc-message">(.*?)</div>', r.text, re.DOTALL)
    if message_match:
        print('EXCEPTION MESSAGE:', message_match.group(1).strip().replace('\n', ' '))
        
    if not title_match:
        print('BODY SNIPPET:', r.text[:500])
except Exception as e:
    print('ERROR:', e)
