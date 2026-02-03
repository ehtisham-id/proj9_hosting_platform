import { saveLog } from './logService';

let logInterval: NodeJS.Timeout;

// Simulate app logs for testing
export const startLogSimulation = (appId: number, instanceId: string = 'instance-1') => {
  if (logInterval) clearInterval(logInterval);
  
  logInterval = setInterval(async () => {
    const logType = Math.random() > 0.7 ? 'stderr' : 'stdout';
    const messages = {
      stdout: [
        `Server running on port 8080`,
        `GET /api/users 200 12ms`,
        `Health check passed`,
        `Processed 150 requests/min`,
        `Memory usage: 45MB`
      ],
      stderr: [
        `WARN: Rate limit hit for IP 192.168.1.100`,
        `ERROR: Database connection timeout`,
        `Failed to parse JSON payload`,
        `Circuit breaker opened`
      ]
    };
    
    const message = messages[logType][Math.floor(Math.random() * messages[logType].length)];
    await saveLog(appId, logType as any, message, instanceId);
  }, 2000 + Math.random() * 3000); // 2-5 seconds interval
};

export const stopLogSimulation = (appId: number) => {
  if (logInterval) {
    clearInterval(logInterval);
    logInterval = undefined as any;
  }
};
