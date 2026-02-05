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
    // Assign dynamic ports (30000-40000 range)
    const ports: number[] = [];
    for (let i = 0; i < instanceCount; i++) {
      ports.push(30000 + (appId * 100 + i) % 10000);
    }

    // Generate upstream servers
    const upstreams = ports.map((port, i) => `app-${appId}-instance-${i} ${port}`);
    
    const config = `
upstream app-${appId} {
  least_conn;
  ${upstreams.map(u => `  server 127.0.0.1:${u.split(' ')[1]};`).join('\n')}
}

server {
  listen 80;
  server_name ${appName}.heroku-clone.local;
  
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
      await execAsync('nginx -t && nginx -s reload || echo "NGINX reload simulated"');
    } catch (error) {
      console.log('NGINX reload simulated for development');
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
