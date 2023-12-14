FROM mcr.microsoft.com/vscode/devcontainers/php:8-bullseye

RUN apt update && \
	apt dist-upgrade -y && \
	apt full-upgrade -y

RUN apt install curl -y

RUN apt install nano -y

RUN apt install zsh -y

RUN apt install exa -y

RUN apt install wget -y

RUN apt install git -y

RUN apt install python3 -y && \
	apt install python3-pip -y

RUN git config --global user.name "jgotz" && \
	git config --global user.email "jonas.goetz01@web.de"

RUN apt install sed -y

ENV NODE_VERSION=20.10.0

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

ENV NVM_DIR=/root/.nvm

RUN chmod -R 777 /usr/local/share/nvm

RUN /usr/local/share/nvm/nvm.sh install ${NODE_VERSION}

RUN /usr/local/share/nvm/nvm.sh use v${NODE_VERSION}

RUN /usr/local/share/nvm/nvm.sh alias default v${NODE_VERSION}

ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

RUN npm install -g @angular/cli npm