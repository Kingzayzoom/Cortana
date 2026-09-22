// Argument schemas for the agents' Prime tools. Safe to import in the browser.
import { z } from "zod";
export const primeToolSchemas = {
  get_prime_session: z.object({}).strict(),
  submit_prime_answer: z
    .object({
      sessionId: z.string().uuid(),
      questionId: z.string().min(1).max(80),
      answer: z.string().trim().min(1).max(300),
    })
    .strict(),
  get_prime_feedback: z.object({ sessionId: z.string().uuid() }).strict(),
  complete_prime: z.object({ sessionId: z.string().uuid() }).strict(),
  advance_prime: z
    .object({
      sessionId: z.string().uuid(),
      questionId: z.string().min(1).max(80),
    })
    .strict(),
};
export const primeToolNames = Object.keys(
  primeToolSchemas,
) as (keyof typeof primeToolSchemas)[];
export function isPrimeTool(
  name: string,
): name is keyof typeof primeToolSchemas {
  return Object.hasOwn(primeToolSchemas, name);
}
