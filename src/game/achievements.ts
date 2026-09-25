export interface Achievement {
  id: string;
  title: string;
  text: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'wood', title: 'Pierwsze drewno', text: 'Zdobądź pień drzewa.' },
  { id: 'craft', title: 'Rzemieślnik', text: 'Wytwórz pierwszy przedmiot.' },
  { id: 'pick', title: 'Górnik', text: 'Wytwórz kilof.' },
  { id: 'torch', title: 'Niech się stanie światłość', text: 'Postaw pochodnię.' },
  { id: 'tree', title: 'Leśnik', text: 'Wyhoduj drzewo z sadzonki.' },
  { id: 'farm', title: 'Rolnik', text: 'Zbierz dojrzałą pszenicę.' },
  { id: 'food', title: 'Smacznego', text: 'Zjedz coś.' },
  { id: 'cave', title: 'Pod ziemią', text: 'Zejdź głęboko do jaskini.' },
  { id: 'coal', title: 'Czarne złoto', text: 'Wydobądź węgiel.' },
  { id: 'iron', title: 'Epoka żelaza', text: 'Wytop sztabkę żelaza.' },
  { id: 'diamond', title: 'Diamenty!', text: 'Znajdź diament.' },
  { id: 'bed', title: 'Dobranoc', text: 'Prześpij noc w łóżku.' },
  { id: 'night', title: 'Przetrwałeś noc', text: 'Dożyj drugiego dnia.' },
  { id: 'zombie', title: 'Łowca nocy', text: 'Pokonaj zombie.' },
  { id: 'creeper', title: 'Sssss…', text: 'Pokonaj creepera, zanim wybuchnie.' },
  { id: 'boom', title: 'Pirotechnik', text: 'Odpal TNT.' },
  { id: 'home', title: 'Pod własnym dachem', text: 'Postaw drzwi.' },
  { id: 'stash', title: 'Schowek', text: 'Postaw skrzynię.' },
  { id: 'climb', title: 'W górę', text: 'Wejdź po drabinie.' },
  { id: 'shear', title: 'Fryzjer', text: 'Ostrzyż owcę nożycami.' },
  { id: 'loot', title: 'Znalazca', text: 'Otwórz skrzynię ukrytą w jaskiniach.' },
  { id: 'string', title: 'Sieć-pająk', text: 'Zdobądź strunę z pająka.' },
  { id: 'archer', title: 'Łucznik', text: 'Wystrzel strzałę z łuku.' },
  { id: 'skeleton', title: 'Kościeny łowca', text: 'Pokonaj szkieleta.' },
  { id: 'foundry', title: 'Hutnik', text: 'Wytwórz blok żelaza.' },
];

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
