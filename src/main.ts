import { serve } from "https://deno.land/std@0.178.0/http/mod.ts";
import { Bot } from "https://deno.land/x/grammy@v1.14.1/mod.ts";
import { Env } from "https://deno.land/x/env@v2.2.3/env.js";
import TTL from "https://deno.land/x/ttl@1.0.1/mod.ts";

const log = (msg: string) => {
  console.log(`${new Date().toISOString()}: ${msg}`);
};

const chanelRegex = /-\d+$/;

const {
  SERVER_PORT,
  TELEGRAM_TOKEN,
  // deno-lint-ignore no-explicit-any
} = new Env().required as any;

const bot = new Bot(TELEGRAM_TOKEN);
bot.start();

const botWrite = async (channelId: string, message: string) => {
  log(`Bot says to ${channelId}: ${message}`);
  await bot.api.sendMessage(
    channelId,
    message,
    {
      parse_mode: "HTML",
    },
  );
};

const ttlCache = new TTL<number>(100_000);
ttlCache.addEventListener("expired", async (event) => {
  //log(`expired ${event.key} with ttl: ${event.val} ms`);
  await botWrite(
    event.key,
    `Warning! Watchdog fired! ttl: ${event.val} ms`,
  );
});

const pingWatchDog = async (channelId: string, ttl: number) => {
  if (ttl < 5000) {
    throw Error(`watchdog cant be less 5000ms. current : ${ttl}ms`);
  }
  if (ttlCache.has(channelId)) {
    log(`pingWatchDog: ${channelId} with ttl: ${ttl}ms refreshed`);
  } else {
    //log(`pingWatchDog: ${channelId} with ttl: ${ttl} armed`);
    await botWrite(
      channelId,
      `WatchDog armed with ttl: ${ttl}ms!`,
    );
  }

  ttlCache.set(channelId, ttl, ttl);
};

await serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(`Method Not Allowed`, { status: 405 });
  }
  try {
    const url = new URL(req.url);
    const pathData = url.pathname.split("/").filter((c) => c != "");
    if (pathData.length != 2) {
      throw Error("Args error: " + JSON.stringify(pathData));
    }

    const chanel = pathData[0];
    const action = pathData[1];
    if (chanelRegex.test(chanel) == false) {
      throw Error("chanel id error: " + chanel);
    }
    const data = await req.text();
    if (action == "wch") {
      await pingWatchDog(chanel, parseInt(data));
    } else if (action == "msg") {
      await botWrite(chanel, data);
    } else {
      throw Error("action error: " + action);
    }
  } catch (error) {
    return new Response(`Request error: ${error.message}`, { status: 400 });
  }
  return new Response(null, { status: 204 });
}, {
  port: parseInt(SERVER_PORT),
  onListen: ({ port, hostname }) => {
    log(`Starting server at ${hostname}:${port}`);
  },
});
