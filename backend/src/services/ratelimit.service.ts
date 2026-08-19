import { redisConnection } from '../queues/connection';
import { config } from '../config';

export class RateLimiterService {
  /**
   * Format hour string in ISO format for Redis keys e.g. "2026-08-19T23"
   */
  private static getHourKeySuffix(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}`;
  }

  /**
   * Returns the start Date of the next hour window.
   */
  public static getNextHourWindow(date: Date): Date {
    const next = new Date(date);
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    return next;
  }

  /**
   * Checks whether the sender has exceeded their hourly limit.
   * If limit is reached, returns { allowed: false, nextAvailableTime: Date }.
   */
  static async checkHourlyLimit(
    senderId: string,
    maxPerHour: number = config.maxEmailsPerHourPerSender,
    currentTime: Date = new Date()
  ): Promise<{ allowed: boolean; currentCount: number; nextAvailableTime?: Date }> {
    const hourSuffix = this.getHourKeySuffix(currentTime);
    const redisKey = `sender:${senderId}:hour:${hourSuffix}`;

    const rawCount = await redisConnection.get(redisKey);
    const count = rawCount ? parseInt(rawCount, 10) : 0;

    if (count >= maxPerHour) {
      const nextAvailableTime = this.getNextHourWindow(currentTime);
      return {
        allowed: false,
        currentCount: count,
        nextAvailableTime,
      };
    }

    return {
      allowed: true,
      currentCount: count,
    };
  }

  /**
   * Increments the hourly counter for a sender after an email is successfully sent or processed.
   */
  static async incrementHourlyCount(
    senderId: string,
    currentTime: Date = new Date()
  ): Promise<number> {
    const hourSuffix = this.getHourKeySuffix(currentTime);
    const redisKey = `sender:${senderId}:hour:${hourSuffix}`;

    const newCount = await redisConnection.incr(redisKey);
    if (newCount === 1) {
      // Set TTL of 2 hours to auto-clean old keys
      await redisConnection.expire(redisKey, 7200);
    }
    return newCount;
  }

  /**
   * Checks minimum delay between emails per sender.
   * Returns remaining milliseconds to wait, or 0 if allowed immediately.
   */
  static async checkMinDelay(
    senderId: string,
    minDelayMs: number = config.minDelayBetweenEmailsMs,
    currentTimeMs: number = Date.now()
  ): Promise<number> {
    const redisKey = `sender:${senderId}:lastSentAt`;
    const lastSentRaw = await redisConnection.get(redisKey);

    if (!lastSentRaw) {
      return 0;
    }

    const lastSentAt = parseInt(lastSentRaw, 10);
    const elapsed = currentTimeMs - lastSentAt;

    if (elapsed < minDelayMs) {
      return minDelayMs - elapsed;
    }

    return 0;
  }

  /**
   * Updates the lastSentAt timestamp for a sender in Redis.
   */
  static async updateLastSentTime(
    senderId: string,
    timestampMs: number = Date.now()
  ): Promise<void> {
    const redisKey = `sender:${senderId}:lastSentAt`;
    await redisConnection.set(redisKey, timestampMs.toString(), 'EX', 3600);
  }
}
