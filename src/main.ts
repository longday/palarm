import { serve } from "https://deno.land/std@0.178.0/http/mod.ts";
import { Bot } from "https://deno.land/x/grammy@v1.15.3/mod.ts";
import { Menu } from "https://deno.land/x/grammy_menu@v1.1.3/mod.ts";
import { Env } from "https://deno.land/x/env@v2.2.3/env.js";
import TTL from "https://deno.land/x/ttl@1.0.1/mod.ts";
import { chanelRegex, formatMilliseconds, log } from "./utils.ts";
import { DeferredData, WatchdogData } from "./models.ts";

const stats = {
  boot: new Date(),
  lastRequest: new Date(),
  totalRequests: 0,
};

const {
  SERVER_PORT,
  TELEGRAM_TOKEN,
  // deno-lint-ignore no-explicit-any
} = new Env().required as any;

const bot = new Bot(TELEGRAM_TOKEN);
//https://grammy.dev/plugins/menu.html
const menu = new Menu("my-menu-identifier")
  // .text(
  //   "Info",
  //   (ctx) => {
  //     return ctx.reply(
  //       "Server stats:" +
  //         `\nStartup:               ${stats.boot.toISOString()}` +
  //         `\nLast request:      ${stats.lastRequest.toISOString()}` +
  //         `\nTotal requests:   ${stats.totalRequests}`,
  //     );
  //   },
  // ).row()
  .text("Info", (ctx) => {
    if (ctx.chat) {
      const data = watchdogCache.get("wch_" + ctx.chat.id.toString());
      if (data) {
        return ctx.reply(
          "Server stats:" +
            `\nStartup:               ${stats.boot.toISOString()}` +
            `\nLast request:      ${stats.lastRequest.toISOString()}` +
            `\nTotal requests:   ${stats.totalRequests}` +
            "\n\n" +
            "Watchdog stats: \n" +
            `\n Armed: ${new Date(data.init).toISOString()}` +
            `\n Fire at: ${new Date(data.update + data.ttl).toISOString()}` +
            `\n Updated at: ${new Date(data.update).toISOString()}` +
            `\n Updated ttl: ${data.ttl} ms` +
            `\n Updated count: ${data.count}`,
        );
      }
    }

    return ctx.reply("no data");
  });

bot.use(menu);

bot.command("start", async (ctx) => {
  await ctx.reply("Menu:", { reply_markup: menu });
});
bot.start();

const botWrite = async (channelId: string, message: string) => {
  log(`Bot says to ${channelId}: ${message}`);
  return;
  await bot.api.sendMessage(
    channelId,
    message,
    {
      parse_mode: "HTML",
    },
  );
};

const watchdogCache = new TTL<WatchdogData>(60_000);
const deferredCache = new TTL<DeferredData>(60_000);
watchdogCache.addEventListener("expired", async (event) => {
  //log("watchdogCache expired event: " + event.key);
  await botWrite(
    event.key,
    `⚠️ Watchdog fired. TTL: ${formatMilliseconds(event.val?.ttl ?? 0)}.`,
  );
});

deferredCache.addEventListener("expired", async (event) => {
  //log("deferredCache expired event: " + event.key);
  if (event.val) {
    await botWrite(
      event.val.channelId,
      `${new Date(event.val.init).toISOString()}: ${event.val?.message}`,
    );
  }
});

const sendMessage = async (
  channelId: string,
  message: string,
  delayId: string,
  delayMs: number,
) => {
  if (delayId != "" && delayMs > 0) {
    deferredCache.set(delayId + channelId, {
      channelId,
      message,
      init: Date.now(),
    }, delayMs);
    log(
      `channelId: ${channelId};delayId: ${delayId}; delay: ${delayMs}; message: ${message}`,
    );
  } else {
    await botWrite(channelId, message);
  }
};

const removeDeferredMessage = (
  channelId: string,
  delayId: string,
) => deferredCache.del(delayId + channelId);

const pingWatchDog = async (channelId: string, ttl: number) => {
  if (ttl < 5000) {
    throw Error(`watchdog cant be less 5000ms. current : ${ttl}ms`);
  }
  let data = watchdogCache.get(channelId);
  if (data) {
    data.update = Date.now();
    data.count++;
    data.ttl = ttl;
    log(`pingWatchDog: ${channelId} with ttl: ${ttl}ms refreshed`);
  } else {
    data = {
      init: Date.now(),
      update: Date.now(),
      count: 0,
      ttl: ttl,
    };
    await botWrite(
      channelId,
      `✅ Watchdog armed. TTL: ${formatMilliseconds(ttl)}.`,
    );
  }

  watchdogCache.set(channelId, data, ttl);
};

await serve(async (req) => {
  stats.totalRequests++;
  stats.lastRequest = new Date();
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
      await sendMessage(
        chanel,
        data,
        url.searchParams.get("did") || "",
        parseInt(url.searchParams.get("ms") || "0"),
      );
    } else if (action == "dclr") {
      removeDeferredMessage(chanel, url.searchParams.get("did") || "");
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
