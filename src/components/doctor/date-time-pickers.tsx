import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/use-theme';
import { MinimumTouchTarget, Radius, Spacing } from '@/constants/theme';
import { DAYS, validDay } from '@/features/doctor/doctor-agenda';

function isoDate(d:Date){return d.toISOString().slice(0,10);}
function addDays(date:string,days:number){
  const v=validDay(date)?date:isoDate(new Date());
  const d=new Date(v+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+days);
  return isoDate(d);
}
export function NativeDayPicker({label,value,onChange,disabled=false}:{
  label:string;value:string;onChange:(value:string)=>void;disabled?:boolean;
}){
  const theme=useTheme();
  const [open,setOpen]=useState(false);
  const [viewMonth,setViewMonth]=useState(()=>{
    const d=validDay(value)?value:isoDate(new Date());return d.slice(0,7);
  });
  const month=new Date(viewMonth+'-01T12:00:00Z');
  const year=month.getUTCFullYear(),m=month.getUTCMonth();
  const monthName=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(month);
  const days=new Date(Date.UTC(year,m+1,0)).getUTCDate();
  const offset=(new Date(Date.UTC(year,m,1)).getUTCDay()+6)%7;
  function shiftMonth(delta:number){const v=new Date(Date.UTC(year,m+delta,1));setViewMonth(isoDate(v).slice(0,7));}
  return <View style={{gap:Spacing.two}}>
    <ThemedText type="smallBold">{label}</ThemedText>
    <Button label={validDay(value)?value:'Choisir une date'} variant="outline" disabled={disabled}
      onPress={()=>{setViewMonth((validDay(value)?value:isoDate(new Date())).slice(0,7));setOpen(true);}}/>
    <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}>
      <View style={[styles.scrim,{backgroundColor:theme.overlay}]}>
        <View style={[styles.panel,{backgroundColor:theme.backgroundElement,borderColor:theme.border}]}>
          <View style={styles.monthRow}>
            <Button label="‹" variant="outline" onPress={()=>shiftMonth(-1)}/>
            <ThemedText type="smallBold">{monthName}</ThemedText>
            <Button label="›" variant="outline" onPress={()=>shiftMonth(1)}/>
          </View>
          <View style={styles.grid}>
            {DAYS.map(d=><View key={d.id} style={styles.cell}>
              <ThemedText type="small" themeColor="textSecondary">{d.label.slice(0,2)}</ThemedText>
            </View>)}
            {Array.from({length:offset},(_,i)=><View key={'blank'+i} style={styles.cell}/>)}
            {Array.from({length:days},(_,i)=>{
              const d=`${year}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
              return <Pressable key={d} accessibilityRole="button" accessibilityLabel={d}
                accessibilityState={{selected:value===d}} onPress={()=>{onChange(d);setOpen(false);}}
                style={[styles.cell,{backgroundColor:value===d?theme.infoSurface:'transparent',borderRadius:Radius.large}]}>
                <ThemedText style={{color:value===d?theme.primary:theme.text}}>{i+1}</ThemedText>
              </Pressable>;
            })}
          </View>
          <View style={styles.monthRow}>
            <Button label="Aujourd’hui" variant="outline" onPress={()=>{onChange(isoDate(new Date()));setOpen(false);}}/>
            <Button label="Fermer" variant="outline" onPress={()=>setOpen(false)}/>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}
const toMinutes=(s:string)=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)?
  Number(s.slice(0,2))*60+Number(s.slice(3)):9*60;
const fromMinutes=(x:number)=>{
  const v=((x%1440)+1440)%1440;return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;
};
export function NativeTimePicker({label,value,onChange,disabled=false}:{
  label:string;value:string;onChange:(value:string)=>void;disabled?:boolean;
}){
  const [open,setOpen]=useState(false);
  const [chosen,setChosen]=useState(value);
  const theme=useTheme();
  const mins=toMinutes(chosen);
  const hour=Math.floor(mins/60),minute=mins%60;
  const control=(name:string,val:number,plus:()=>void,minus:()=>void)=><View style={styles.adjust}>
    <Button label="−" variant="outline" onPress={minus}/>
    <ThemedText type="subtitle" textAlign="center">{String(val).padStart(2,'0')}</ThemedText>
    <Button label="+" variant="outline" onPress={plus}/>
  </View>;
  return <View style={{gap:Spacing.two}}>
    <ThemedText type="smallBold">{label}</ThemedText>
    <Button label={value||'Choisir une heure'} variant="outline" disabled={disabled}
      onPress={()=>{setChosen(value||'09:00');setOpen(true);}}/>
    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}>
      <View style={[styles.scrim,{backgroundColor:theme.overlay}]}>
        <View style={[styles.panel,{backgroundColor:theme.backgroundElement,borderColor:theme.border}]}>
          <ThemedText type="subtitle">Choisir l’heure (24 h)</ThemedText>
          <View style={styles.monthRow}>
            <View style={styles.adjust}>
              <ThemedText type="smallBold">Heures</ThemedText>
              {control('Heures',hour,()=>setChosen(fromMinutes(mins+60)),()=>setChosen(fromMinutes(mins-60)))}
            </View>
            <View style={styles.adjust}>
              <ThemedText type="smallBold">Minutes</ThemedText>
              {control('Minutes',minute,()=>setChosen(fromMinutes(mins+1)),()=>setChosen(fromMinutes(mins-1)))}
            </View>
          </View>
          <ThemedText type="subtitle" textAlign="center">{chosen}</ThemedText>
          <Button label="Utiliser cette heure" onPress={()=>{onChange(chosen);setOpen(false);}}/>
          <Button label="Annuler" variant="outline" onPress={()=>setOpen(false)}/>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  scrim:{flex:1,justifyContent:'center',padding:Spacing.three},
  panel:{padding:Spacing.three,borderWidth:1,borderRadius:Radius.xlarge,gap:Spacing.three,maxWidth:470,width:'100%',alignSelf:'center'},
  monthRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:Spacing.two},
  grid:{flexDirection:'row',flexWrap:'wrap'},cell:{width:'14.2857%',minHeight:MinimumTouchTarget,alignItems:'center',justifyContent:'center'},
  adjust:{alignItems:'center',gap:Spacing.two},
});
