FROM ubuntu:latest

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

RUN sed -i 's|/bin/bash|/bin/zsh|' /etc/passwd

RUN wget https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh && \
	chmod 755 install.sh && \
	./install.sh && \
	rm install.sh

COPY .nanorc /root/.nanorc

COPY .zsh_aliase /root/.zsh_aliase

RUN cat ~/.zsh_aliase >> ~/.zshrc

ENV NODE_VERSION=20.10.0

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

ENV NVM_DIR=/root/.nvm

RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}

RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}

RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}

ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

RUN npm install -g @angular/cli npm

CMD ["/bin/zsh"]