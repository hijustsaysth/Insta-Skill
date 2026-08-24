import type { InstagramClient } from "@instagram-skills/instagram-core";
import type { Context } from "@deepseek-ai/cordis";

declare const ctx: Context;

const client: InstagramClient = ctx.instagram;
const dispose = ctx.provide("instagram", client);

void client.profile;
void client.media;
void client.publish;
void dispose;
