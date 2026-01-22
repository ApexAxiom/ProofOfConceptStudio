/**
 * Formats a timestamp to show both CST and AWST times
 * Since we serve both regions, show both timezones
 */
export function formatTimestampWithTimezones(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Format for CST (America/Chicago)
  const cstTime = d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  
  // Format for AWST (Australia/Perth)
  const awstTime = d.toLocaleTimeString("en-US", {
    timeZone: "Australia/Perth",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  
  return `${cstTime} CST / ${awstTime} AWST`;
}

/**
 * Formats a timestamp for a specific region
 */
export function formatTimestampForRegion(date: Date | string, region: 'us' | 'au'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (region === 'au') {
    const time = d.toLocaleTimeString("en-US", {
      timeZone: "Australia/Perth",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    return `${time} AWST`;
  } else {
    const time = d.toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    return `${time} CST`;
  }
}

/**
 * Formats a full date with timezone
 */
export function formatDateWithTimezone(date: Date | string, region?: 'us' | 'au'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (region === 'au') {
    return d.toLocaleString("en-US", {
      timeZone: "Australia/Perth",
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true
    }) + " AWST";
  } else if (region === 'us') {
    return d.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true
    }) + " CST";
  } else {
    // Show both
    const cstDate = d.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true
    });
    const awstDate = d.toLocaleString("en-US", {
      timeZone: "Australia/Perth",
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true
    });
    return `${cstDate} CST / ${awstDate} AWST`;
  }
}
