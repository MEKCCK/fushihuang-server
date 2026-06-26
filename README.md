docker-compose.yml 使用完整操作文档
 
适配系统：Arch、Ubuntu、Fedora
 
一、文件基础说明
 
 docker-compose.yml  是 Docker Compose 容器编排配置文件，所有操作必须在该文件所在目录执行，示例路径： /home/elite/Documents/docker-compose.yml 
 
二、分系统安装 Docker + Compose
 
1. Arch
  
# 安装组件
sudo pacman -S docker docker-compose
# 启动并设置开机自启
sudo systemctl enable --now docker
# 用户加入docker组，免sudo操作
sudo usermod -aG docker $USER
# 刷新权限，无需重启终端
newgrp docker
 
 
2.Ubuntu 20.04+
 
sudo apt update
sudo apt install docker.io docker-compose-v2 -y
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
 
3. Fedora 36+

# 安装docker全套
sudo dnf install docker docker-compose-plugin -y
# 启动服务并开机自启
sudo systemctl enable --now docker
# 配置免sudo权限
sudo usermod -aG docker $USER
newgrp docker
 
 
三、全系统通用前置步骤
 
进入  docker-compose.yml  存放目录（示例路径）
 
cd ~/Documents
 
四、全系统通用 Compose 核心命令
 
新版标准命令： docker compose （无横杠）
旧版兼容命令： docker-compose （带横杠，老旧工具包）
 
1. 后台启动容器（日常使用）
 
docker compose up -d
 
 
参数  -d ：后台分离运行，不占用终端
 
2. 查看容器运行状态

docker compose ps
 
 
3. 实时查看日志（排错专用）
  
# 查看所有服务实时日志
docker compose logs -f
# 仅查看单个服务日志，替换为yml内定义的服务名
docker compose logs -f 服务名
 
 
4. 停止并销毁容器（保留数据卷、镜像）

docker compose down
 
 
彻底销毁容器+持久化存储数据（谨慎执行，数据丢失）
  
docker compose down -v
 
5. 修改yml配置后重载生效

# 先停止旧容器，重新创建并启动
docker compose down && docker compose up -d
 
6. 拉取镜像更新

docker compose pull
 
 
7. 重启指定服务

docker compose restart 服务名
 
 
五、补充特殊场景
 
1. 自定义配置文件名（非默认  docker-compose.yml ）
  
# -f 指定配置文件路径
docker compose -f xxx.yml up -d
 
 
2. 权限报错处理
执行  newgrp docker  刷新用户组，或关闭终端重新登录；
临时方案：所有命令前加  sudo ，如  sudo docker compose up -d 。
