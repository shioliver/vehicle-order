#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AmplifyStack } from '../lib/amplify-stack';

const app = new cdk.App();

// 部署区域：默认东京，可通过环境变量 AWS_REGION 覆盖
// 注意：Amplify Hosting 在 ap-east-1（香港）也支持，但东京 (ap-northeast-1) 资源更齐全、构建更稳定
const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;

new AmplifyStack(app, 'VehicleInspectionAmplifyStack', {
  env: { account, region },
  description: '车辆检测系统 - AWS Amplify Hosting 部署栈',
  // 下列环境变量必须在执行 cdk deploy 之前设置：
  //   GITHUB_OWNER  GitHub 用户名 / 组织名
  //   GITHUB_REPO   仓库名
  //   GITHUB_BRANCH 部署分支，默认 main
  //   GITHUB_TOKEN  GitHub Personal Access Token，需 admin:repo_hook + repo 权限
  //   DEEPSEEK_API_KEY 可选，注入到构建环境（VITE_DEEPSEEK_API_KEY）
  githubOwner: process.env.GITHUB_OWNER ?? '',
  githubRepo: process.env.GITHUB_REPO ?? '',
  githubBranch: process.env.GITHUB_BRANCH ?? 'main',
  githubTokenSecretValue: process.env.GITHUB_TOKEN ?? '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? ''
});

app.synth();
