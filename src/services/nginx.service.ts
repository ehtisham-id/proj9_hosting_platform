import { pool } from '../config/database.config';
import { getInstanceCount } from './scaling.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

export interface NginxConfig {
  appId: number;
  appName: string;
  upstreams: string[];
  ports: number[];
  config: string;
}

export class NginxManager {
  private static instance: NginxManager;
  private configDir = '/tmp/nginx-heroku-clone';

  static getInstance() {
    if (!NginxManager.instance) {
      NginxManager.instance = new NginxManager();
    }
    return NginxManager.instance;
  }

  async init() {
    await fs.mkdir(this.configDir, { recursive: true });
  }

  async generateAppConfig(appId: number): Promise<NginxConfig> {
    await this.init();
    const appResult = await pool.query(
      'SELECT name FROM apps WHERE id = $1',
      [appId]
    );
    
    if (appResult.rows.length === 0) {
      throw new Error('App not found');
    }

    const appName = appResult.rows[0].name;
    const instanceCount = await getInstanceCount(appId);
    const appPort = parseInt(process.env.APP_PORT || "8080", 10);
    const ports: number[] = Array.from({ length: instanceCount }, () => appPort);

    // Containers are named in docker.service.ts
    const upstreams = Array.from(
      { length: instanceCount },
      (_, i) => `heroku-clone-app-${appId}-instance-${i}`,
    );
    
    const config = `
upstream app-${appId} {
  least_conn;
  ${upstreams.map(name => `  server ${name}:${appPort} resolve;`).join('\n')}
}

server {
  listen 80;
  server_name ${appName}.heroku-clone.local;
  resolver 127.0.0.11 valid=10s;
  resolver_timeout 5s;
  
  location / {
    proxy_pass http://app-${appId};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
`;

    const configPath = path.join(this.configDir, `app-${appId}.conf`);
    await fs.writeFile(configPath, config);

    return {
      appId,
      appName,
      upstreams,
      ports,
      config
    };
  }

  async reloadNginx(): Promise<void> {
    try {
      const execAsync = promisify(exec);
      const nginxContainer = process.env.NGINX_CONTAINER || 'heroku-clone-nginx';
      await execAsync(`docker exec ${nginxContainer} nginx -t`);
      await execAsync(`docker exec ${nginxContainer} nginx -s reload`);
    } catch (error) {
      console.log('NGINX reload failed or simulated for development');
    }
  }

  async generateMainConfig(): Promise<void> {
    await this.init();
    const defaultConfigPath = path.join(this.configDir, '00-default.conf');
    const defaultConfig = `
server {
  listen 80 default_server;
  server_name _;
  return 503 'No apps deployed';
}
`;
    await fs.writeFile(defaultConfigPath, defaultConfig);
  }
}

export const nginxManager = NginxManager.getInstance();
