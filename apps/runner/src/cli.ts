import { handleCron, runAgent } from "./run.js";
import { initializeSecrets } from "./lib/secrets.js";
import { RunWindow, RegionSlug } from "@proof/shared";
import { loadAgents } from "./agents/config.js";

function printUsage() {
  console.log(`
Usage: tsx src/cli.ts <command> [options]

Commands:
  run <run-window> [--region <region>]
    Run all agents for the specified run window (apac or international)
    Options:
      --region <region>   Only run agents for specific region (au or us-mx-la-lng)
  
  agent <agent-id> <region> [run-window]
    Run a specific agent for a specific region
    
  list
    List all configured agents and their regions

Examples:
  tsx src/cli.ts run apac                        # Run all APAC agents
  tsx src/cli.ts run international               # Run all international agents  
  tsx src/cli.ts run apac --region au            # Run APAC with only AU region
  tsx src/cli.ts agent rigs-integrated-drilling au apac
  tsx src/cli.ts list
`);
}

async function main() {
  // Load secrets from AWS Secrets Manager before running
  await initializeSecrets();

  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case "run": {
      const runWindow = args[1] as RunWindow;
      if (!runWindow || !["apac", "international"].includes(runWindow)) {
        console.error("Error: run window must be 'apac' or 'international'");
        printUsage();
        process.exit(1);
      }

      // Parse optional --region flag
      let regions: RegionSlug[] | undefined;
      const regionIdx = args.indexOf("--region");
      if (regionIdx !== -1 && args[regionIdx + 1]) {
        const region = args[regionIdx + 1] as RegionSlug;
        if (!["au", "us-mx-la-lng"].includes(region)) {
          console.error("Error: region must be 'au' or 'us-mx-la-lng'");
          process.exit(1);
        }
        regions = [region];
      }

      console.log(`🚀 Starting ${runWindow} run${regions ? ` for region: ${regions.join(", ")}` : " for all regions"}...`);
      
      try {
        const result = await handleCron(runWindow, { regions });
        console.log(`\n📊 Run Summary (${result.runId}):`);
        console.log(`   ✅ Successes: ${result.successes}`);
        console.log(`   ❌ Failures: ${result.failures}`);
        
        if (!result.ok) {
          console.error("\n⚠️  Some agents failed. Check logs above for details.");
          process.exit(1);
        }
        console.log("\n✨ All agents completed successfully!");
      } catch (err) {
        console.error("Fatal error:", err);
        process.exit(1);
      }
      break;
    }

    case "agent": {
      const agentId = args[1];
      const region = args[2] as RegionSlug;
      const runWindow = (args[3] as RunWindow) || (region === "au" ? "apac" : "international");

      if (!agentId || !region) {
        console.error("Error: agent command requires <agent-id> and <region>");
        printUsage();
        process.exit(1);
      }

      if (!["au", "us-mx-la-lng"].includes(region)) {
        console.error("Error: region must be 'au' or 'us-mx-la-lng'");
        process.exit(1);
      }

      console.log(`🚀 Running agent ${agentId} for region ${region} (${runWindow})...`);
      
      try {
        const result = await runAgent(agentId, region, runWindow);
        if (result.ok) {
          console.log(`✅ Agent ${agentId} completed successfully for ${region}`);
        } else {
          console.error(`❌ Agent ${agentId} failed for ${region}: ${result.error}`);
          process.exit(1);
        }
      } catch (err) {
        console.error("Fatal error:", err);
        process.exit(1);
      }
      break;
    }

    case "list": {
      const agents = loadAgents();
      console.log("\n📋 Configured Agents:\n");
      for (const agent of agents) {
        const regions = Object.keys(agent.feedsByRegion).join(", ");
        const mode = agent.mode || "brief";
        console.log(`  ${agent.id}`);
        console.log(`    Label: ${agent.label}`);
        console.log(`    Mode: ${mode}`);
        console.log(`    Regions: ${regions}`);
        console.log(`    Articles per run: ${agent.articlesPerRun}`);
        console.log("");
      }
      console.log(`Total: ${agents.length} agents`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main();
