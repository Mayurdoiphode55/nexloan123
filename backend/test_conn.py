import asyncio
import asyncpg

async def test():
    conn = await asyncpg.connect(
        'postgresql://postgres.alurshsogvsedsjapqfi:T8JWC1DR9OULVLVy@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres',
        statement_cache_size=0
    )
    r = await conn.fetchrow('SELECT 1 AS ok')
    print(f'Connection OK: {r}')
    
    # Test multiple queries (simulates selectin loading)
    for i in range(5):
        r = await conn.fetchrow('SELECT $1::int AS num', i)
        print(f'  Query {i}: {r}')
    
    await conn.close()
    print('All queries passed with statement_cache_size=0!')

asyncio.run(test())
