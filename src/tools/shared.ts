import { z } from "zod";
import { PERIOD_NAMES } from "../types.js";

/** Bugsink accepts either the UUID or the friendly id, e.g. PROJECT-1234. */
export const issueRef = z.string().min(1).describe("Issue UUID or friendly ID (e.g. PROJECT-1234)");

/** Derived from the domain type, so the vocabulary is declared exactly once. */
export const periodName = z.enum(PERIOD_NAMES);

export const nrOfPeriods = z.number().int().min(1).describe("How many periods");
