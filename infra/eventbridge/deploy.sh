#!/bin/bash
# Deploy EventBridge Scheduler for daily brief runs

STACK_NAME="briefs-scheduler"
RUNNER_BASE_URL="https://pe8rz3uzip.us-east-1.awsapprunner.com"
SECRET_ARN="arn:aws:secretsmanager:us-east-1:405894865970:secret:daily-briefs/app-secrets-hFtQFU"

aws cloudformation deploy \
  --template-file scheduler.yml \
  --stack-name $STACK_NAME \
  --parameter-overrides \
    RunnerBaseUrl=$RUNNER_BASE_URL \
    SecretArn=$SECRET_ARN \
  --capabilities CAPABILITY_IAM \
  --region us-east-1