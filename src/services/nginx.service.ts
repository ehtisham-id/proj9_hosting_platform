import { pool } from "../config/database.config";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface NginxConfig {
  appId: number;
  appName: string;
  upstreams: string[];
  ports: number[];
  config: string;
}

export class NginxManager {
  private static instance: NginxManager;
  private configDir = "/tmp/nginx-heroku-clone";

  static getInstance() {
    if (!NginxManager.instance) {
      NginxManager.instance = new NginxManager();
    }
    return NginxManager.instance;
  }

  async init() {
    await fs.mkdir(this.configDir, { recursive: true });
    // Ensure a default config always exists so nginx doesn't fail
    // on empty include glob
    await this.generateMainConfig();
  }

  /**
   * Generate nginx config for an app.
   * @param appId - The app ID
   * @param actualInstances - The actual number of deployed instances (from docker)
   *   If not provided, we discover running containers via docker ps.
   */
  async generateAppConfig(
    appId: number,
    actualInstances?: number,
  ): Promise<NginxConfig> {
    await this.init();
    const appResult = await pool.query("SELECT name FROM apps WHERE id = $1", [
      appId,
    ]);

    if (appResult.rows.length === 0) {
      throw new Error("App not found");
    }

    const appName = appResult.rows[0].name;
    const appPort = parseInt(process.env.APP_PORT || "8080", 10);

    // Determine how many instances are actually running
    let instanceCount: number;
    if (actualInstances !== undefined) {
      instanceCount = actualInstances;
    } else {
      // Discover from docker
      try {
        const { stdout } = await execAsync(
          `docker ps --filter "name=heroku-clone-app-${appId}-instance" --format "{{.ID}}"`,
        );
        instanceCount = stdout.trim() ? stdout.trim().split("\n").length : 0;
      } catch {
        instanceCount = 0;
      }
    }

    if (instanceCount === 0) {
      // No instances running — remove config so nginx doesn't fail
      await this.removeAppConfig(appId);
      return {
        appId,
        appName,
        upstreams: [],
        ports: [],
        config: "",
      };
    }

    const ports: number[] = Array.from(
      { length: instanceCount },
      () => appPort,
    );

    // Containers are named in docker.service.ts
    const upstreams = Array.from(
      { length: instanceCount },
      (_, i) => `heroku-clone-app-${appId}-instance-${i}`,
    );

    // Use variables + resolver to allow runtime DNS resolution so nginx
    // doesn't crash if a host is temporarily unreachable.
    // Each upstream gets its own location or we use an upstream block.
    // For open-source nginx, the safest approach with dynamic DNS is to use
    // a variable-based proxy_pass (avoids startup DNS check).
    let config: string;
    if (instanceCount === 1) {
      // Single instance: use variable-based proxy_pass (no upstream block needed)
      const target = `${upstreams[0]}:${appPort}`;
      config = [
        "",
        "server {",
        "  listen 80;",
        `  server_name ${appName}.heroku-clone.local;`,
        "  resolver 127.0.0.11 valid=10s ipv6=off;",
        "  resolver_timeout 5s;",
        "",
        "  location / {",
        `    set ${"$"}backend "http://${target}";`,
        `    proxy_pass ${"$"}backend;`,
        "    proxy_http_version 1.1;",
        "    proxy_set_header Upgrade $http_upgrade;",
        "    proxy_set_header Connection 'upgrade';",
        "    proxy_set_header Host $host;",
        "    proxy_set_header X-Real-IP $remote_addr;",
        "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
        "    proxy_set_header X-Forwarded-Proto $scheme;",
        "    proxy_cache_bypass $http_upgrade;",
        "  }",
        "}",
        "",
      ].join("\n");
    } else {
      // Multiple instances: use upstream block.
      config = [
        "",
        `upstream app-${appId} {`,
        "  least_conn;",
        ...upstreams.map((name) => `  server ${name}:${appPort};`),
        "}",
        "",
        "server {",
        "  listen 80;",
        `  server_name ${appName}.heroku-clone.local;`,
        "  resolver 127.0.0.11 valid=10s ipv6=off;",
        "  resolver_timeout 5s;",
        "",
        "  location / {",
        `    proxy_pass http://app-${appId};`,
        "    proxy_http_version 1.1;",
        "    proxy_set_header Upgrade $http_upgrade;",
        "    proxy_set_header Connection 'upgrade';",
        "    proxy_set_header Host $host;",
        "    proxy_set_header X-Real-IP $remote_addr;",
        "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
        "    proxy_set_header X-Forwarded-Proto $scheme;",
        "    proxy_cache_bypass $http_upgrade;",
        "  }",
        "}",
        "",
      ].join("\n");
    }

    const configPath = path.join(this.configDir, `app-${appId}.conf`);
    await fs.writeFile(configPath, config);

    return {
      appId,
      appName,
      upstreams,
      ports,
      config,
    };
  }

  /** Remove the nginx config for a specific app */
  async removeAppConfig(appId: number): Promise<void> {
    const configPath = path.join(this.configDir, `app-${appId}.conf`);
    try {
      await fs.unlink(configPath);
    } catch {
      // File didn't exist — that's fine
    }
  }

  async reloadNginx(): Promise<void> {
    const nginxContainer = process.env.NGINX_CONTAINER || "heroku-clone-nginx";
    try {
      // Check if nginx container is running
      const { stdout: status } = await execAsync(
        `docker inspect -f '{{.State.Running}}' ${nginxContainer} 2>/dev/null || echo 'false'`,
      );
      if (status.trim() !== "true") {
        console.log("NGINX container is not running, skipping reload");
        return;
      }
      await execAsync(`docker exec ${nginxContainer} nginx -t 2>&1`);
      await execAsync(`docker exec ${nginxContainer} nginx -s reload`);
      console.log("NGINX reloaded successfully");
    } catch (error) {
      console.error("NGINX reload failed:", (error as Error).message);
    }
  }

  async generateMainConfig(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    const defaultConfigPath = path.join(this.configDir, "00-default.conf");
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
