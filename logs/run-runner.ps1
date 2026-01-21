$env:PORT='3002'
$env:OPENAI_API_KEY=''
$env:OPENAI_MODEL='gpt-4o'
$env:CRON_SECRET='change-me'
$env:DDB_TABLE_NAME='CMHub'
$env:AWS_REGION='us-east-1'
cd 'h:\POCStudio'
pnpm --filter runner dev
