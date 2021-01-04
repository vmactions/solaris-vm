const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const io = require('@actions/io');
const fs = require("fs");
const path = require("path");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function execSSH(cmd, desp = "") {
  core.info(desp);
  core.info("exec ssh: " + cmd);
  await exec.exec("ssh -t solaris", [], { input: cmd });
}


async function getScreenText(vmName) {
  let png = path.join(__dirname, "/screen.png");
  await vboxmanage(vmName, "controlvm", "screenshotpng  " + png);
  await exec.exec("sudo chmod 666 " + png);
  let output = "";
  await exec.exec("pytesseract  " + png, [], {
    listeners: {
      stdout: (s) => {
        output += s;
      }
    }
  });
  return output;
}

async function waitFor(vmName, tag) {

  let slept = 0;
  while (true) {
    slept += 1;
    if (slept >= 300) {
      throw new Error("Timeout can not boot");
    }
    await sleep(1000);

    let output = await getScreenText(vmName);

    if (tag) {
      if (output.includes(tag)) {
        core.info("OK");
        await sleep(1000);
        return true;
      } else {
        core.info("Checking, please wait....");
      }
    } else {
      if (!output.trim()) {
        core.info("OK");
        return true;
      } else {
        core.info("Checking, please wait....");
      }
    }

  }

  return false;
}


async function vboxmanage(vmName, cmd, args = "") {
  await exec.exec("sudo  vboxmanage " + cmd + "   " + vmName + "   " + args);
}

async function setup(nat, mem) {
  try {

    let sshport = 2223;
    fs.appendFileSync(path.join(process.env["HOME"], "/.ssh/config"), "Host solaris " + "\n");
    fs.appendFileSync(path.join(process.env["HOME"], "/.ssh/config"), " User root" + "\n");
    fs.appendFileSync(path.join(process.env["HOME"], "/.ssh/config"), " HostName localhost" + "\n");
    fs.appendFileSync(path.join(process.env["HOME"], "/.ssh/config"), " Port " + sshport + "\n");
    fs.appendFileSync(path.join(process.env["HOME"], "/.ssh/config"), "StrictHostKeyChecking=accept-new\n");


    let workingDir = __dirname;

    if (process.env["DEBUG"]) {
      let sdk = "https://download.virtualbox.org/virtualbox/6.1.14/Oracle_VM_VirtualBox_Extension_Pack-6.1.14.vbox-extpack";
      core.info("Downloading sdk: " + sdk);
      let img = await tc.downloadTool(sdk);
      core.info("Downloaded file: " + img);
      await io.mv(img, path.join(workingDir, "./Oracle_VM_VirtualBox_Extension_Pack-6.1.14.vbox-extpack"));
      await exec.exec("sudo vboxmanage extpack install    --replace " + path.join(workingDir, "./Oracle_VM_VirtualBox_Extension_Pack-6.1.14.vbox-extpack"), [], { input: "y\n" });


      let ng = await tc.downloadTool("https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-darwin-amd64.zip");

      let token = process.env["NGROK_TOKEN"];
      await io.mv(ng, path.join(workingDir, "./ngrok-stable-darwin-amd64.zip"));
      await exec.exec("unzip -o " + path.join(workingDir, "./ngrok-stable-darwin-amd64.zip"));
      await exec.exec("./ngrok authtoken " + token);
      exec.exec("./ngrok  tcp   3390").catch((e) => {
        //
      });
    }


    core.info("Install tesseract");
    await exec.exec("brew install tesseract");
    await exec.exec("pip3 install pytesseract");


    let imgName = "sol-11_4-vbox";
    let ova = imgName + ".ova";
    let part0 = "https://github.com/vmactions/solaris-builder/releases/download/v0.0.4/sol-11_4-vbox.ova.zip";
    let part1 = "https://github.com/vmactions/solaris-builder/releases/download/v0.0.4/sol-11_4-vbox.ova.z01";


    {
      core.info("Downloading image: " + part0);
      let img = await tc.downloadTool(part0);
      core.info("Downloaded file: " + img);
      await io.mv(img, path.join(workingDir, "./" + ova + ".zip"));

    }

    {
      core.info("Downloading image: " + part1);
      let img = await tc.downloadTool(part1);
      core.info("Downloaded file: " + img);
      await io.mv(img, path.join(workingDir, "./" + ova + ".z01"));
    }

    await exec.exec("7za e -y " + path.join(workingDir, ova + ".zip") + "  -o" + workingDir);

    await vboxmanage("", "import", path.join(workingDir, ova));

    //the ssh port was already added in the builder.
    //await vboxmanage(imgName, "modifyvm", '--natpf1 "guestssh,tcp,,' + sshport + ',,22"');

    if (nat) {
      let nats = nat.split("\n").filter(x => x !== "");
      for (let element of nats) {
        core.info("Add nat: " + element);
        let segs = element.split(":");
        if (segs.length === 3) {
          //udp:"8081": "80"
          let proto = segs[0].trim().trim('"');
          let hostPort = segs[1].trim().trim('"');
          let vmPort = segs[2].trim().trim('"');
          await vboxmanage(imgName, "modifyvm", "  --natpf1 '" + hostPort + "," + proto + ",," + hostPort + ",," + vmPort + "'");

        } else if (segs.length === 2) {
          let proto = "tcp"
          let hostPort = segs[0].trim().trim('"');
          let vmPort = segs[1].trim().trim('"');
          await vboxmanage(imgName, "modifyvm", "  --natpf1 '" + hostPort + "," + proto + ",," + hostPort + ",," + vmPort + "'");
        }
      };
    }
    if (mem) {
      await vboxmanage(imgName, "modifyvm", "  --memory " + mem);
    }

    await vboxmanage(imgName, "startvm", " --type headless");

    await waitFor(imgName, "Loading NVIDIA Kernel Mode Setting Driver for UNIX platforms");
    await sleep(1000);

    await waitFor(imgName, "Hostname: solaris");
    await sleep(1000);


    let sshHome = path.join(process.env["HOME"], ".ssh");
    let authorized_keys = path.join(sshHome, "authorized_keys");

    fs.appendFileSync(authorized_keys, fs.readFileSync(path.join(workingDir, "id_rsa.pub")));

    fs.appendFileSync(path.join(sshHome, "config"), "SendEnv   CI  GITHUB_* \n");
    await exec.exec("chmod 700 " + sshHome);



    let cmd1 = "mkdir -p /Users/runner/work && ln -s /Users/runner/work/  work";
    await execSSH(cmd1, "Setting up VM");

    await exec.exec("rsync -auvzrtopg  --exclude _actions/vmactions/solaris-vm  /Users/runner/work/ solaris:work");


    core.info("OK, Ready!");

  }
  catch (error) {
    core.setFailed(error.message);
  }
}





async function main() {
  let nat = core.getInput("nat");
  core.info("nat: " + nat);

  let mem = core.getInput("mem");
  core.info("mem: " + mem);

  await setup(nat, mem);

  var envs = core.getInput("envs");
  console.log("envs:" + envs);
  if (envs) {
    fs.appendFileSync(path.join(process.env["HOME"], "/.ssh/config"), "SendEnv " + envs + "\n");
  }

  var prepare = core.getInput("prepare");
  if (prepare) {
    core.info("Running prepare: " + prepare);
    await exec.exec("ssh -t solaris", [], { input: prepare });
  }

  var run = core.getInput("run");
  console.log("run: " + run);

  try {
    await exec.exec("ssh solaris sh -c 'cd $GITHUB_WORKSPACE && exec sh'", [], { input: run });
  } catch (error) {
    core.setFailed(error.message);
  } finally {
    core.info("get back by rsync");
    await exec.exec("rsync -uvzrtopg  solaris:work/ /Users/runner/work");
  }
}



main().catch(ex => {
  core.setFailed(ex.message);
});

