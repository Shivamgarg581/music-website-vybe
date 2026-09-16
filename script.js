const songs=[
 {title:'Kesariya',artist:'Arijit Singh',query:'Kesariya Brahmastra official video'},
 {title:'Tum Hi Ho',artist:'Arijit Singh',query:'Tum Hi Ho Aashiqui 2 official video'},
 {title:'Chaleya',artist:'Arijit Singh, Shilpa Rao',query:'Chaleya Jawan official video'},
 {title:'Apna Bana Le',artist:'Arijit Singh',query:'Apna Bana Le Bhediya official video'},
 {title:'O Maahi',artist:'Arijit Singh',query:'O Maahi Dunki official video'},
 {title:'Tujhe Kitna Chahne Lage',artist:'Arijit Singh',query:'Tujhe Kitna Chahne Lage Kabir Singh official video'},
 {title:'Satranga',artist:'Arijit Singh',query:'Satranga Animal official video'},
 {title:'Ve Kamleya',artist:'Arijit Singh, Shreya Ghoshal',query:'Ve Kamleya Rocky Aur Rani official video'}
];
let player=null, current=-1, timer=null, ready=false;
const $=id=>document.getElementById(id);
function showToast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function render(list=songs){$('results').innerHTML=list.map((s,i)=>`<article class="song-card" data-index="${songs.indexOf(s)}"><div class="cover">♪</div><div class="song-title">${s.title}</div><div class="song-artist">${s.artist}</div></article>`).join('');document.querySelectorAll('.song-card').forEach(c=>c.onclick=()=>playIndex(Number(c.dataset.index)))}
function onYouTubeIframeAPIReady(){player=new YT.Player('youtubePlayer',{height:'1',width:'1',videoId:'',playerVars:{playsinline:1,controls:0,rel:0},events:{onReady:()=>{ready=true},onStateChange:e=>{if(e.data===YT.PlayerState.PLAYING){$('playBtn').textContent='Ⅱ';startTimer()}else if(e.data===YT.PlayerState.PAUSED||e.data===YT.PlayerState.ENDED){$('playBtn').textContent='▶';stopTimer();if(e.data===YT.PlayerState.ENDED)next()}}}})}
async function playIndex(i){const s=songs[i];if(!ready){showToast('YouTube player is still loading');return}current=i;$('playerTitle').textContent=s.title;$('playerArtist').textContent=s.artist;$('playerCover').textContent='♪';$('playBtn').textContent='Ⅱ';stopTimer();showToast('Playing official YouTube result');
 // Search is intentionally delegated to YouTube's public search UI/API architecture; replace query with a videoId from an authorized search backend in production.
 showToast('Open the official YouTube result for playback');
 window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(s.query),'_blank','noopener,noreferrer');
}
function startTimer(){stopTimer();timer=setInterval(()=>{if(!player||!ready)return;const d=player.getDuration()||0,c=player.getCurrentTime()||0;$('timeLabel').textContent=fmt(c);$('durationLabel').textContent=fmt(d);$('progressRange').disabled=!d;$('progressRange').value=d?(c/d*100):0},500)}
function stopTimer(){if(timer){clearInterval(timer);timer=null}}
function fmt(x){x=Math.floor(x||0);return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0')}
function next(){if(!songs.length)return;playIndex((current+1)%songs.length)}
$('playBtn').onclick=()=>{if(!ready){showToast('Player loading…');return}if(current<0){playIndex(0);return}player.getPlayerState()===YT.PlayerState.PLAYING?player.pauseVideo():player.playVideo()};
$('nextBtn').onclick=next;$('prevBtn').onclick=()=>playIndex((current-1+songs.length)%songs.length);
$('progressRange').oninput=e=>{if(player&&ready){const d=player.getDuration()||0;player.seekTo(d*(Number(e.target.value)/100),true)}};
$('exploreBtn').onclick=()=>{$('searchInput').focus();$('search').scrollIntoView({behavior:'smooth'})};
$('clearSearch').onclick=()=>{$('searchInput').value='';render()};
$('searchInput').oninput=e=>{const q=e.target.value.trim().toLowerCase();render(q?songs.filter(s=>(s.title+' '+s.artist).toLowerCase().includes(q)):songs)};
document.querySelectorAll('.mood-card').forEach(b=>b.onclick=()=>{$('searchInput').value=b.dataset.query;showToast('Try this vibe in YouTube search');$('search').scrollIntoView({behavior:'smooth'})});
render();
