$env:PORT='3001'
$env:OPENAI_API_KEY=''
$env:OPENAI_MODEL='gpt-4o'
$env:RUNNER_BASE_URL='http://localhost:3002'
$env:DDB_TABLE_NAME='CMHub'
$env:AWS_REGION='us-east-1'
cd 'h:\POCStudio'
pnpm --filter api dev
