import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { factorSchema, sectorScoreSchema } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const schema = z.toJSONSchema(sectorScoreSchema, { target: "draft-7" });
await writeFile(resolve(here, "../../../schemas/sector-score.v1.schema.json"), `${JSON.stringify(schema, null, 2)}\n`);
