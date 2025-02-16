This backend is based on RealTimeSTT, a super fast real time speech to text based on Fast-Whisper. Thank you to KoljaB for providing amazing library.

The main backend file is backend/stt_2.py, all older versions are available in the 'exploration' directory. The file depends on 'llm.py' for the llm management and 'redis_client'. In order to run this project, you need to setup a VM on Scaleway. To do so, follow the tutorial on their website. 
Once done, connect to your VM and create a venv.
Run
```
sudo apt-get update
sudo apt-get install portaudio19-dev python3-dev`
sudo apt install ffmpeg
sudo apt install libgl1-mesa-glx
sudo apt update && sudo apt install redis
pip install redis
pip install RealTimeSTT
```
And activate your venv. You'll also need to create a REDIS DB (once agin check the relevent Scaleway ressources). 

Change in the frontend code (frontend/app/index.tsx) the serveur IP and the backend code backend (backend/stt_2.py) the db IP.

You need to export your Mistral api key:
```
export MISTRAL_API_KEY=
```

To run the server run "python3 backend/stt_2.py".
