#!/bin/bash
#
# functions for setting up the marketing dashboard (Next.js)
#
# O dashboard roda no mesmo VPS, em processo próprio no PM2 e atrás do nginx.
# Ele NÃO usa o node do sistema (16.x, exigido pelo whaticket): o Next.js precisa
# de Node >= 18, então instalamos um runtime dedicado em /opt/node20.

dashboard_node20_install() {
  print_banner
  printf "${WHITE} 💻 Instalando Node 20 dedicado ao dashboard (/opt/node20)...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - root <<EOF
  if [ ! -x /opt/node20/bin/node ]; then
    ARCH=\$(uname -m)
    case "\$ARCH" in
      x86_64) NODE_ARCH=x64 ;;
      aarch64|arm64) NODE_ARCH=arm64 ;;
      *) NODE_ARCH=x64 ;;
    esac
    NODE_VERSION=v20.18.1
    curl -fsSL "https://nodejs.org/dist/\${NODE_VERSION}/node-\${NODE_VERSION}-linux-\${NODE_ARCH}.tar.xz" -o /tmp/node20.tar.xz
    mkdir -p /opt/node20
    tar -xJf /tmp/node20.tar.xz -C /opt/node20 --strip-components=1
    rm -f /tmp/node20.tar.xz
  fi
  /opt/node20/bin/node -v
EOF

  sleep 2
}

#######################################
# copies the dashboard source to the deploy user
# Arguments:
#   None
#######################################
dashboard_copy_files() {
  print_banner
  printf "${WHITE} 💻 Copiando os arquivos do dashboard...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - root <<EOF
  mkdir -p /home/deploy/${dashboard_name}
  cp -r "${PROJECT_ROOT}"/dashboard/. /home/deploy/${dashboard_name}/
  rm -rf /home/deploy/${dashboard_name}/node_modules /home/deploy/${dashboard_name}/.next
  chown -R deploy:deploy /home/deploy/${dashboard_name}
EOF

  sleep 2
}

#######################################
# writes the dashboard .env
# Arguments:
#   None
#######################################
dashboard_set_env() {
  print_banner
  printf "${WHITE} 💻 Configurando variáveis de ambiente (dashboard)...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  # ensure idempotency
  dashboard_url=$(echo "${dashboard_url/https:\/\/}")
  dashboard_url=${dashboard_url%%/*}
  dashboard_url=https://$dashboard_url

sudo su - deploy << EOF
  cat <<[-]EOF > /home/deploy/${dashboard_name}/.env
PORT=${dashboard_port}
HOSTNAME=127.0.0.1

DASHBOARD_TIMEZONE=America/Sao_Paulo
CACHE_TTL_SECONDS=300
CLIENTS_CONFIG_PATH=/home/deploy/${dashboard_name}/config/clients.json

ADS_PROVIDER=windsor
WINDSOR_API_KEY=${windsor_api_key}
WINDSOR_SEND_ACCOUNT_FILTER=false

GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_API_VERSION=v18

META_ACCESS_TOKEN=
META_API_VERSION=v21.0

CRM_PROVIDER=rdstation

# Token da conta do RD Station CRM (Configurações > Integrações > API).
# Uma conta por cliente? Crie uma variável por cliente aqui embaixo, no formato
# RD_CRM_TOKEN_<CLIENTE>, e aponte o NOME dela no campo rdCrmTokenEnv de
# config/clients.json. O token nunca vai para o clients.json.
RD_CRM_TOKEN=${rd_crm_token}

RD_CRM_API_VERSION=v1
RD_CRM_API_BASE=https://crm.rdstation.com/api/v1
RD_CRM_V2_API_BASE=https://api.rd.services/crm/v2
RD_CRM_PAGE_SIZE=200
RD_CRM_MAX_PAGES=30
RD_WON_STAGES=
RD_UTM_SOURCE_FIELD=utm_source
RD_UTM_CAMPAIGN_FIELD=utm_campaign
[-]EOF
  chmod 600 /home/deploy/${dashboard_name}/.env
EOF

  sleep 2
}

#######################################
# grava as credenciais master como hash
#
# A senha nunca vai para o .env: o script scripts/set-password.mjs gera o hash
# scrypt e grava em config/secrets.json com permissão 600.
# Arguments:
#   None
#######################################
dashboard_set_master_password() {
  print_banner
  printf "${WHITE} 💻 Gravando as credenciais master...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  export PATH=/opt/node20/bin:\$PATH
  cd /home/deploy/${dashboard_name}
  node scripts/set-password.mjs "${dashboard_user}" "${dashboard_password}"
EOF

  sleep 2
}

#######################################
# installs node packages
# Arguments:
#   None
#######################################
dashboard_node_dependencies() {
  print_banner
  printf "${WHITE} 💻 Instalando dependências do dashboard...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  export PATH=/opt/node20/bin:\$PATH
  cd /home/deploy/${dashboard_name}
  npm install --no-audit --no-fund
EOF

  sleep 2
}

#######################################
# builds the dashboard
# Arguments:
#   None
#######################################
dashboard_node_build() {
  print_banner
  printf "${WHITE} 💻 Compilando o dashboard...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  # O build usa as devDependencies (typescript, tailwind); depois o standalone
  # só carrega o que o Next empacotou.
  sudo su - deploy <<EOF
  export PATH=/opt/node20/bin:\$PATH
  cd /home/deploy/${dashboard_name}
  npm run build
  # o servidor standalone roda de dentro de .next/standalone
  cp -r public .next/standalone/public 2>/dev/null || true
  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/static
  cp .env .next/standalone/.env
  cp -r config .next/standalone/config
EOF

  sleep 2
}

#######################################
# starts the dashboard with pm2
# Arguments:
#   None
#######################################
dashboard_start_pm2() {
  print_banner
  printf "${WHITE} 💻 Iniciando pm2 (dashboard)...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - deploy <<EOF
  export PATH=/opt/node20/bin:\$PATH
  cd /home/deploy/${dashboard_name}
  pm2 delete ${dashboard_name} 2>/dev/null
  PORT=${dashboard_port} HOSTNAME=127.0.0.1 pm2 start .next/standalone/server.js \
    --name ${dashboard_name} \
    --interpreter /opt/node20/bin/node
  pm2 save
EOF

  sleep 2
}

#######################################
# sets up nginx for the dashboard
# Arguments:
#   None
#######################################
dashboard_nginx_setup() {
  print_banner
  printf "${WHITE} 💻 Configurando nginx (dashboard)...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  dashboard_hostname=$(echo "${dashboard_url/https:\/\/}")

sudo su - root << EOF

cat > /etc/nginx/sites-available/${dashboard_name} << 'END'
server {
  server_name $dashboard_hostname;

  location / {
    proxy_pass http://127.0.0.1:${dashboard_port};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_cache_bypass \$http_upgrade;
    proxy_read_timeout 120s;
  }
}
END

rm -f /etc/nginx/sites-enabled/${dashboard_name}
ln -s /etc/nginx/sites-available/${dashboard_name} /etc/nginx/sites-enabled
service nginx restart
EOF

  sleep 2
}

#######################################
# issues the ssl certificate
# Arguments:
#   None
#######################################
dashboard_certbot_setup() {
  print_banner
  printf "${WHITE} 💻 Emitindo certificado SSL do dashboard...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  dashboard_domain=$(echo "${dashboard_url/https:\/\/}")

  sudo su - root <<EOF
  certbot -m $deploy_email \
          --nginx \
          --agree-tos \
          --non-interactive \
          --domains $dashboard_domain
EOF

  sleep 2
}

#######################################
# updates an existing dashboard install
# Arguments:
#   None
#######################################
dashboard_update() {
  print_banner
  printf "${WHITE} 💻 Atualizando o dashboard...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2

  sudo su - root <<EOF
  rsync -a --delete \
    --exclude node_modules --exclude .next --exclude .env --exclude config/clients.json \
    "${PROJECT_ROOT}"/dashboard/ /home/deploy/${dashboard_name}/ 2>/dev/null || \
  cp -r "${PROJECT_ROOT}"/dashboard/src "${PROJECT_ROOT}"/dashboard/package.json /home/deploy/${dashboard_name}/
  chown -R deploy:deploy /home/deploy/${dashboard_name}
EOF

  sleep 2

  dashboard_node_dependencies
  dashboard_node_build

  sudo su - deploy <<EOF
  export PATH=/opt/node20/bin:\$PATH
  pm2 restart ${dashboard_name}
  pm2 save
EOF

  sleep 2

  print_banner
  printf "${WHITE} 💻 Dashboard atualizado com sucesso...${GRAY_LIGHT}"
  printf "\n\n"

  sleep 2
}

#######################################
# prints the final instructions
# Arguments:
#   None
#######################################
dashboard_done() {
  print_banner
  printf "${WHITE} 💻 Dashboard instalado!${GRAY_LIGHT}"
  printf "\n\n"
  printf "${WHITE}   Endereço:  ${dashboard_url}${GRAY_LIGHT}\n"
  printf "${WHITE}   Usuário:   ${dashboard_user}${GRAY_LIGHT}\n"
  printf "${WHITE}   Senha:     a que você digitou nesta instalação${GRAY_LIGHT}\n\n"
  printf "${WHITE}   Próximo passo: entre no painel e abra Administração para${GRAY_LIGHT}\n"
  printf "${WHITE}   cadastrar clientes, contas de anúncio e tokens do CRM.${GRAY_LIGHT}\n"
  printf "${WHITE}   Nada disso exige SSH nem reiniciar o servidor.${GRAY_LIGHT}\n\n"
}
