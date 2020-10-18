# Run GitHub CI in FreeBSD

Use this action to run your CI in FreeBSD.

The github workflow only supports Ubuntu, Windows and MacOS. But what if you need a FreeBSD?

This action is to support FreeBSD.


Sample workflow `freebsd.yml`:

```yml

name: Test

on: [push]

jobs:
  testsolaris:
    runs-on: macos-latest
    name: A job to run test Solaris
    env:
      MYTOKEN : ${{ secrets.MYTOKEN }}
      MYTOKEN2: "value2"
    steps:
    - uses: actions/checkout@v2
    - name: Test in solaris
      id: test
      uses: vmactions/solaris-vm@v0.0.1
      with:
        envs: 'MYTOKEN MYTOKEN2'
        prepare: |
          echo "1\ny" |  pkgadd -v   -d http://get.opencsw.org/now
          /opt/csw/bin/pkgutil -U
          /opt/csw/bin/pkgutil -y -i socat
        nat: |
          "8080": "80"
          "8443": "443"
          udp:"8081": "80"
        run: |
          if [ -n "test" ]; then
            echo "false"
          fi
          if [ "test" ]; then
            echo "test"
          fi
          pwd
          ls -lah
          whoami
          env
          cat /etc/release
          echo "OK"


```


The `runs-on: macos-latest` must be `macos-latest`.

The `envs: 'MYTOKEN MYTOKEN2'` is the env names that you want to pass into solaris vm.

The `run: xxxxx `  is the command you want to run in solaris vm.

The env variables are all copied into the VM, and the source code and directory are all synchronized into the VM.


The working dir for `run` in the VM is the same as in the Host machine.

All the source code tree in the Host machine are mounted into the VM.

All the `GITHUB_*` as well as `CI=true` env variables are passed into the VM.

So, you will have the same directory and same defualt env variables when you `run` the CI script.


You can add NAT port between the host and the VM.

```
...
    steps:
    - uses: actions/checkout@v2
    - name: Test in solaris
      id: test
      uses: vmactions/solaris-vm@v0.0.1
      with:
        envs: 'MYTOKEN MYTOKEN2'
        usesh: true
        nat: |
          "8080": "80"
          "8443": "443"
          udp:"8081": "80"
...
```


# Under the hood

GitHub only supports Ubuntu, Windows and MacOS out of the box. 

However, the MacOS support virtualization. It has VirtualBox installed.

So, we run the Solaris VM in VirbualBox on MacOS.










