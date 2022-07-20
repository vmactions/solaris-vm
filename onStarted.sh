#run in the vm as soon as the vm is started, before run the "prepare"



/opt/csw/bin/pkgutil -U

/opt/csw/bin/pkgutil -y -i cacertificates

rm -rf /etc/openssl/certs/*

cp /etc/opt/csw/ssl/certs/* /etc/openssl/certs/



