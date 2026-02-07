import { Response } from "express";
import { dockerSandbox } from "../services/docker.service";
import {
  getInstanceCount,
  setInstanceCount,
  getScalingMetrics,
} from "../services/scaling.service";
import { AuthRequest } from "../middleware/rbac.middleware";
import { pool } from "../config/database.config";
import { nginxManager } from "../services/nginx.service";
import Joi from "joi";

const deploySchema = Joi.object({
  instances: Joi.number().min(1).max(10).optional(),
  env_vars: Joi.object().optional(),
  image: Joi.string().trim().allow("", null).max(500).optional(),
});

export const deployHandler = async (req: AuthRequest, res: Response) => {
  const { error, value } = deploySchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const appId = parseInt(req.params.id);
    if (isNaN(appId)) {
      return res.status(400).json({ error: "Invalid app id" });
    }

    // Verify ownership
    const appResult = await pool.query(
      "SELECT user_id FROM apps WHERE id = $1",
      [appId],
    );
    if (
      appResult.rows.length === 0 ||
      appResult.rows[0].user_id !== req.user!.userId
    ) {
      return res.status(403).json({ error: "App not found or access denied" });
    }

    const instances = value.instances
      ? parseInt(String(value.instances))
      : await getInstanceCount(appId);
    const envVars: Record<string, string> = value.env_vars || {};
    const image: string | undefined = value.image?.trim() || undefined;

    // Deploy with sandbox
    const deployedCount = await dockerSandbox.deployApp(
      appId,
      instances,
      envVars,
      image,
    );

    // Sync instance count in DB/Redis to match actual deployment
    await setInstanceCount(appId, deployedCount);

    // Update app status
    await pool.query(
      "UPDATE apps SET status = 'running', last_deployed = NOW() WHERE id = $1",
      [appId],
    );

    // Generate nginx config for the actually deployed instances
    try {
      await nginxManager.generateAppConfig(appId, deployedCount);
      await nginxManager.reloadNginx();
    } catch (nginxErr) {
      console.error("NGINX config generation failed:", nginxErr);
    }

    const metrics = await getScalingMetrics(appId);

    // Small delay to let Docker register the container in `docker ps`
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const containers = await dockerSandbox.getContainers(appId);

    res.json({
      message: `Deployed ${deployedCount} instances successfully`,
      instances: deployedCount,
      status: "running",
      containers,
      metrics,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Deployment failed", details: (error as Error).message });
  }
};

export const stopHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    if (isNaN(appId)) {
      return res.status(400).json({ error: "Invalid app id" });
    }

    // Ownership check
    const appResult = await pool.query(
      "SELECT user_id FROM apps WHERE id = $1",
      [appId],
    );
    if (
      appResult.rows.length === 0 ||
      appResult.rows[0].user_id !== req.user!.userId
    ) {
      return res.status(403).json({ error: "App not found" });
    }

    await dockerSandbox.stopApp(appId);
    await pool.query("UPDATE apps SET status = 'stopped' WHERE id = $1", [
      appId,
    ]);

    // Remove nginx config so nginx doesn't fail on missing upstreams
    try {
      await nginxManager.removeAppConfig(appId);
      await nginxManager.reloadNginx();
    } catch (nginxErr) {
      console.error("NGINX config removal failed:", nginxErr);
    }

    res.json({ message: "App stopped successfully", status: "stopped" });
  } catch (error) {
    res.status(500).json({ error: "Stop failed" });
  }
};

export const containersHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    if (isNaN(appId)) {
      return res.status(400).json({ error: "Invalid app id" });
    }
    const appResult = await pool.query(
      "SELECT user_id FROM apps WHERE id = $1",
      [appId],
    );
    if (
      appResult.rows.length === 0 ||
      appResult.rows[0].user_id !== req.user!.userId
    ) {
      return res.status(403).json({ error: "App not found" });
    }
    const containers = await dockerSandbox.getContainers(appId);
    res.json({ containers, count: containers.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch containers" });
  }
};
