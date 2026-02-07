import { exec } from "child_process";
import { promisify } from "util";
import { redisClient } from "../config/database.config";
import { saveLog } from "./log.service";

const execAsync = promisify(exec);

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  ports: string;
}

const dockerNetwork = process.env.DOCKER_NETWORK || "heroku-clone-net";
const appPort = parseInt(process.env.APP_PORT || "8080", 10);

class DockerSandbox {
  private static instance: DockerSandbox;
  private containers: Map<number, string[]> = new Map(); // appId -> containerIds

  static getInstance() {
    if (!DockerSandbox.instance) {
      DockerSandbox.instance = new DockerSandbox();
    }
    return DockerSandbox.instance;
  }

  /** Ensure the Docker network exists before deploying containers */
  async ensureNetwork(): Promise<void> {
    try {
      await execAsync(
        `docker network inspect ${dockerNetwork} >/dev/null 2>&1 || docker network create ${dockerNetwork}`,
      );
    } catch (error) {
      console.error("Failed to ensure Docker network:", error);
    }
  }

  async deployApp(
    appId: number,
    instances: number = 1,
    envVars: Record<string, string> = {},
    image?: string,
  ) {
    // Ensure the Docker network exists
    await this.ensureNetwork();

    const redisKey = `app:${appId}:deployed`;
    const isDeployed = await redisClient.get(redisKey);
    if (isDeployed) {
      await this.stopApp(appId);
    }

    const containerIds: string[] = [];

    for (let i = 0; i < instances; i++) {
      const instanceId = `app-${appId}-instance-${i}`;
      const containerName = `heroku-clone-${instanceId}`;

      // Strict security constraints
      const baseImage = image || "node:20-alpine";

      // Build image + command. Use single quotes around the node script
      // to avoid shell interpretation issues (no single quotes in JS code).
      let imageAndCommand: string;
      if (image) {
        // User-provided image: run it as-is (no default node script)
        console.log(`[Docker] Using custom image: ${image}`);
        imageAndCommand = baseImage;
      } else {
        // No image provided: use default node:20-alpine with built-in HTTP server
        console.log(`[Docker] Using default simulated app with ${baseImage}`);
        const nodeScript = `var http=require("http");var port=process.env.PORT||${appPort};http.createServer(function(req,res){res.writeHead(200,{"Content-Type":"text/plain"});res.end("ok")}).listen(port,function(){console.log("listening",port)});setInterval(function(){console.log("["+new Date().toISOString()+"] [STDOUT] Simulated app running...")},2000)`;
        imageAndCommand = `${baseImage} node -e '${nodeScript}'`;
      }

      // Build env vars with safe quoting
      const envString = Object.entries(envVars)
        .map(([k, v]) => `-e ${k}='${v.replace(/'/g, "'\\''")}' `)
        .join(" ");

      // Only set default PORT if user hasn't provided one in envVars
      const portEnv = envVars.PORT ? "" : `-e PORT=${appPort}`;

      const cmd = [
        "docker run -d",
        `--name ${containerName}`,
        `--network ${dockerNetwork}`,
        `--network-alias ${containerName}`,
        "--memory=256m",
        "--cpus=0.5",
        "--ulimit nofile=1024:1024",
        "--read-only",
        "--tmpfs /tmp:size=64m",
        // Also add writable dirs that some images need
        "--tmpfs /var/cache:size=32m",
        "--tmpfs /var/run:size=8m",
        portEnv,
        envString,
        imageAndCommand,
      ]
        .filter(Boolean)
        .join(" ");

      try {
        console.log(`[Docker] Running: ${cmd}`);
        const { stdout } = await execAsync(cmd);
        const containerId = stdout.trim();
        containerIds.push(containerId);

        // Log deployment
        await saveLog(
          appId,
          "stdout",
          `Instance ${i + 1}/${instances} deployed: ${containerId.slice(0, 12)}`,
          instanceId,
        );
      } catch (error: any) {
        console.error(
          `Failed to deploy instance ${i}:`,
          error?.stderr || error?.message || error,
        );
        await saveLog(
          appId,
          "stderr",
          `Failed to deploy instance ${i}: ${error}`,
          instanceId,
        );
      }
    }

    this.containers.set(appId, containerIds);
    await redisClient.set(redisKey, "true", { EX: 86400 }); // 24h TTL
    return containerIds.length;
  }

  async stopApp(appId: number) {
    // Use docker ps to find actual running containers instead of only in-memory Map
    try {
      const { stdout } = await execAsync(
        `docker ps -a --filter "name=heroku-clone-app-${appId}-instance" --format "{{.ID}}"`,
      );
      const liveIds = stdout.trim().split("\n").filter(Boolean);
      for (const containerId of liveIds) {
        try {
          await execAsync(`docker stop ${containerId} 2>/dev/null || true`);
          await execAsync(`docker rm ${containerId} 2>/dev/null || true`);
        } catch (error) {
          console.error(`Failed to stop container ${containerId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to list containers for app ${appId}:`, error);
    }
    this.containers.delete(appId);
    await redisClient.del(`app:${appId}:deployed`);
  }

  async getContainers(appId: number): Promise<ContainerInfo[]> {
    // Use docker ps -a to discover containers (including stopped/crashed ones)
    try {
      const { stdout } = await execAsync(
        `docker ps -a --filter "name=heroku-clone-app-${appId}-instance" --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"`,
      );
      if (!stdout.trim()) return [];
      return stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [id, name, status, ports] = line.split("\t");
          return { id, name, status, ports: ports || "" };
        });
    } catch (error) {
      console.error(`Failed to list containers for app ${appId}:`, error);
      return [];
    }
  }
}

export const dockerSandbox = DockerSandbox.getInstance();

// Enhanced Docker security constraints: build a secure docker run command from inputs
export function buildSecureRunCmd(
  containerName: string,
  envVars: Record<string, string> = {},
): string {
  const envString = Object.entries(envVars)
    .map(([k, v]) => `-e ${k}=${v.replace(/"/g, '\\"')}`)
    .join(" ");
  return `
    docker run -d \
      --name ${containerName} \
      --rm \
      --network none \
      --memory=128m \
      --cpus=0.25 \
      --ulimit nofile=512:512 \
      --ulimit nproc=100:100 \
      --read-only \
      --tmpfs /tmp:size=32m \
      --cap-drop=ALL \
      --cap-add=CHOWN \
      --security-opt no-new-privileges \
      --pids-limit=256 \
      ${envString} \
      node:20-alpine \
      sh -c "
        echo 'App sandbox started securely';
        while true; do 
          echo '[$(date)] [STDOUT] Secure app running...'; 
          sleep 3; 
        done
      "
  `;
}
