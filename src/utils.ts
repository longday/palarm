export const log = (msg: string) => {
  console.log(`${new Date().toISOString()}: ${msg}`);
};

export const chanelRegex = /-\d+$/;

export const formatMilliseconds = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  const remainingMilliseconds = milliseconds % 1000;

  const formattedDays = days > 0 ? `${days}d ` : "";
  const formattedHours = remainingHours < 10
    ? `0${remainingHours}`
    : `${remainingHours}`;
  const formattedMinutes = remainingMinutes < 10
    ? `0${remainingMinutes}`
    : `${remainingMinutes}`;
  const formattedSeconds = remainingSeconds < 10
    ? `0${remainingSeconds}`
    : `${remainingSeconds}`;
  const formattedMilliseconds = remainingMilliseconds < 100
    ? `0${remainingMilliseconds}`
    : `${remainingMilliseconds}`;

  return `${formattedDays}${formattedHours}:${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`;
};
