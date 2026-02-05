import { exec } from "child_process";
import { promisify } from "util";
import { pool, redisClient } from "../config/database.config";
import { saveLog } from "./log.service";

const execAsync = promisify(exec);

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  ports: string;
}

class DockerSandbox {
  private static instance: DockerSandbox;
  private containers: Map<number, string[]> = new Map(); // appId -> containerIds

  static getInstance() {
    if (!DockerSandbox.instance) {
      DockerSandbox.instance = new DockerSandbox();
    }
    return DockerSandbox.instance;
  }

  async deployApp(
    appId: number,
    instances: number = 1,
    envVars: Record<string, string> = {},
  ) {
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
      const cmd = `
        docker run -d \
          --name ${containerName} \
          --rm \
          --network none \
          --memory=256m \
          --cpus=0.5 \
          --ulimit nofile=1024:1024 \
          --read-only \
          --tmpfs /tmp:size=64m \
          -e PORT=8080 \
          ${Object.entries(envVars)
            .map(([k, v]) => `-e ${k}=${v.replace(/"/g, '\\"')}`)
            .join(" ")} \
          node:20-alpine \
          sh -c "while true; do echo '[\$(date)] [STDOUT] Simulated app running...'; sleep 2; done"
      `;

      try {
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
      } catch (error) {
        console.error(`Failed to deploy instance ${i}:`, error);
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
    const containerIds = this.containers.get(appId) || [];
    for (const containerId of containerIds) {
      try {
        await execAsync(`docker stop ${containerId} || true`);
        await execAsync(`docker rm ${containerId} || true`);
      } catch (error) {
        console.error(`Failed to stop container ${containerId}:`, error);
      }
    }
    this.containers.delete(appId);
    await redisClient.del(`app:${appId}:deployed`);
  }

  async getContainers(appId: number): Promise<ContainerInfo[]> {
    const containers: ContainerInfo[] = [];
    const containerIds = this.containers.get(appId) || [];

    for (const containerId of containerIds) {
      try {
        const { stdout } = await execAsync(
          `docker inspect ${containerId} --format '{{json .State.Status}},{{json .Name}}'`,
        );
        const [status, name] = stdout.trim().split(",");
        containers.push({
          id: containerId,
          name: name.replace(/"/g, ""),
          status: status.replace(/"/g, ""),
          ports: "",
        });
      } catch (error) {}
    }
    return containers;
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
