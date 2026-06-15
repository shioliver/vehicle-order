import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import { CodeCommitSourceCodeProvider, GitHubSourceCodeProvider } from '@aws-cdk/aws-amplify-alpha';
import { SecretValue } from 'aws-cdk-lib';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';

export interface AmplifyStackProps extends cdk.StackProps {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  githubTokenSecretValue: string;
  deepseekApiKey: string;
}

export class AmplifyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    if (!props.githubOwner || !props.githubRepo || !props.githubTokenSecretValue) {
      throw new Error(
        '缺少 GitHub 配置：请设置 GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN 环境变量。'
      );
    }

    // 显式声明 BuildSpec，覆盖仓库根 amplify.yml 的内容（保持一致即可，便于 CDK 控制）
    const buildSpec = BuildSpec.fromObjectToYaml({
      version: 1,
      applications: [
        {
          appRoot: 'vehicle-rental-inspection-dispatch',
          frontend: {
            phases: {
              preBuild: { commands: ['npm ci'] },
              build: { commands: ['npm run build'] }
            },
            artifacts: {
              baseDirectory: 'dist',
              files: ['**/*']
            },
            cache: { paths: ['node_modules/**/*'] }
          }
        }
      ]
    });

    const app = new amplify.App(this, 'VehicleInspectionApp', {
      appName: 'vehicle-inspection',
      sourceCodeProvider: new GitHubSourceCodeProvider({
        owner: props.githubOwner,
        repository: props.githubRepo,
        oauthToken: SecretValue.unsafePlainText(props.githubTokenSecretValue)
      }),
      buildSpec,
      environmentVariables: {
        // 让 Amplify 在每次构建时启用 SPA 重写需要的环境变量；如有需要可继续添加
        ...(props.deepseekApiKey ? { VITE_DEEPSEEK_API_KEY: props.deepseekApiKey } : {})
      },
      // 构建产物默认压缩；性能监控可后续加 Performance Mode
      autoBranchDeletion: true
    });

    // SPA 路由 fallback：所有未知路径都回退到 /index.html
    app.addCustomRule({
      source: '</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>',
      target: '/index.html',
      status: amplify.RedirectStatus.REWRITE
    });

    // 主分支：连上即自动构建
    const branch = app.addBranch(props.githubBranch, {
      branchName: props.githubBranch,
      autoBuild: true,
      stage: 'PRODUCTION'
    });

    // 输出
    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: app.appId,
      description: 'Amplify App ID'
    });
    new cdk.CfnOutput(this, 'AmplifyDefaultDomain', {
      value: `https://${branch.branchName}.${app.defaultDomain}`,
      description: '部署成功后的访问地址（Amplify 默认域名）'
    });
    new cdk.CfnOutput(this, 'AmplifyConsoleUrl', {
      value: `https://${this.region}.console.aws.amazon.com/amplify/home?region=${this.region}#/${app.appId}`,
      description: 'Amplify 控制台链接'
    });

    // 抑制未使用的 import 提示
    void CodeCommitSourceCodeProvider;
  }
}
