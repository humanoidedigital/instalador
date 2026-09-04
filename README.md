FAZENDO DOWNLOAD DO INSTALADOR & INICIANDO A PRIMEIRA INSTALAÇÃO (USAR SOMENTE PARA PRIMEIRA INSTALAÇÃO):

```bash
sudo apt install -y git && git clone https://github.com/weliton2k/installsaaskanbanit.git install && sudo chmod -R 777 ./install && cd ./install && sudo ./install_primaria
```

ACESSANDO DIRETORIO DO INSTALADOR & INICIANDO INSTALAÇÕES ADICIONAIS (USAR ESTE COMANDO PARA SEGUNDA OU MAIS INSTALAÇÃO:
```bash
cd && cd ./install && sudo ./install_instancia
```

---

## DASHBOARD DE MARKETING (Google Ads + Meta Ads + RD Station CRM)

Painel com KPIs, funil, pipeline e performance por campanha, com seletor de
cliente e área administrativa para cadastrar clientes, contas de anúncio e
tokens sem SSH. Roda no mesmo VPS, em processo próprio no PM2, sem mexer na
instalação do whaticket.

```bash
cd && cd ./install && sudo ./install_dashboard
```

Documentação completa (credenciais, cadastro de clientes, migração para as APIs
nativas do Google e da Meta): [`dashboard/README.md`](dashboard/README.md).
