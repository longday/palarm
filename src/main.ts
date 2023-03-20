import { serve } from "https://deno.land/std@0.178.0/http/mod.ts";
import { Bot } from "https://deno.land/x/grammy@v1.15.3/mod.ts";
import { Menu } from "https://deno.land/x/grammy_menu@v1.1.3/mod.ts";
import { Env } from "https://deno.land/x/env@v2.2.3/env.js";
import TTL from "https://deno.land/x/ttl@1.0.1/mod.ts";

const stats = {
  boot: new Date(),
  lastRequest: new Date(),
  totalRequests: 0,
};
const log = (msg: string) => {
  console.log(`${new Date().toISOString()}: ${msg}`);
};

const chanelRegex = /-\d+$/;

const {
  SERVER_PORT,
  TELEGRAM_TOKEN,
  // deno-lint-ignore no-explicit-any
} = new Env().required as any;

interface WatchdogData {
  init: number;
  update: number;
  count: number;
}

const bot = new Bot(TELEGRAM_TOKEN);
//https://grammy.dev/plugins/menu.html
const menu = new Menu("my-menu-identifier")
  .text(
    "Server info",
    (ctx) => {
      return ctx.reply(
        "Server stats:" +
          `\nStartup:               ${stats.boot.toISOString()}` +
          `\nLast request:      ${stats.lastRequest.toISOString()}` +
          `\nTotal requests:   ${stats.totalRequests}`,
      );
    },
  ).row()
  .text("Palarm info", (ctx) => {
    if (ctx.chat) {
      const data = ttlCache.get(ctx.chat.id.toString());
      if (data) {
        return ctx.reply(
          "Watchdog stats: \n" +
            `\n Armed: ${new Date(data.init).toISOString()}` +
            `\n Updated at: ${new Date(data.update).toISOString()}` +
            `\n Updated count: ${data.update}`,
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
  await bot.api.sendMessage(
    channelId,
    message,
    {
      parse_mode: "HTML",
    },
  );
};

const ttlCache = new TTL<WatchdogData>(100_000);
ttlCache.addEventListener("expired", async (event) => {
  //log(`expired ${event.key} with ttl: ${event.val} ms`);
  await botWrite(
    event.key,
    `⚠️ Watchdog fired. TTL: ${event.val} ms.`,
  );
});

const pingWatchDog = async (channelId: string, ttl: number) => {
  if (ttl < 5000) {
    throw Error(`watchdog cant be less 5000ms. current : ${ttl}ms`);
  }
  let data = ttlCache.get(channelId);
  if (data) {
    data.update = Date.now();
    data.count++;
    log(`pingWatchDog: ${channelId} with ttl: ${ttl}ms refreshed`);
  } else {
    data = {
      init: Date.now(),
      update: Date.now(),
      count: 0,
    };
    await botWrite(
      channelId,
      `✅ Watchdog armed. TTL: ${ttl} ms.`,
    );
  }

  ttlCache.set(channelId, data, ttl);
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
