
/**
 * @brief   Данная функция создает виртуальное устройство для управления группой света.
 * 
 * @param {String}  title     Описание виртуального устройства (Можно на русском)
 * @param {String}  name      Имя виртуального устройства (Будет отображаться в новом виртуальном кстройстве как name/... )
 * @param {String}  Button    Одиночный топик или массив топиков, по изменению которых 
 *                            будет происходить переключение света (Кнопки)
 * @param {String}  Light     Одиночный топик или массив топиков, которыми будет происходить управление (Реле)
 * @param {boolean} master    true - если это мастер выключатель. Перед отключением группы - запомнит 
 *                            состояние реле и выключит, а при включении включит только те, которые были включены
 * @param {String}  Motion    Одиночный топик или массив топиков, по которым будет отслеживаться движение
 *                            для включения или отключения группы света (Необязательный - если не указать, то 
 *                            и не создадутся контролы для управления по движению).
 */
function createLightingGroup ( title , name , Button , Light , master , Motion ) {

    var firstStartRule = true;      // Флаг первого запуска модуля или перезагрузки правил

    if ( master ) {
        var ps = new PersistentStorage( name + "_storage", { global: true }); // Постоянное хранилище для запоминания состояний реле
    }

    var targetButton = [];  // Массив для хранения устройств физических кнопок
    var targetLight  = [];  // Массив для хранения устройств света
    
    var lightError  = [];   // Массив для хранения устройств света с meta #error 
    var buttonError = [];   // Массив для хранения устройств физических кнопок с meta #error 

    createVirtualDevice( title , name );

    // Первым делом перебираем массивы всех физических устройств и удаляем из массива
    // несуществующие устройства
    reloadDeviceArray( Button , targetButton , buttonError);
    reloadDeviceArray( Light  , targetLight  , lightError);
    
    // Отслеживаем изменение meta #error устройств кнопок и света
    createErrorRule( lightError , name , 'light_' );
    createErrorRule( buttonError , name , 'Button_' );

    if ( Motion ) {
        var targetMotion = [];  // Массив для хранения устройств движения
        var motionError = [];   // Массив для хранения устройств движения с meta #error 
        reloadDeviceArray( Motion , targetMotion , motionError);
        createErrorRule( motionError , name , 'motion_' ); // Отслеживаем изменение meta #error устройств движения
    }


    // Перебираем массив источников света и создаем новые правила для управления 
    // физическим реле прямо из виртуального устройства
    targetLight.forEach( function (item, index, arr) {
        defineRule(name + ' ruleLight #' + index, {
            whenChanged: name + '/light_' + index,
            then: function (newValue, devName, cellName) {
                var s = getDevice(name).getControl( 'light_' + index ).getTitle();
                dev[s] = newValue;
            }
        });
    });


    /**
     * @brief   Правило обработки перезагрузки правил - по идее должно выполниться всего один раз в самом начале.
     *          Тут перебираем массив источников света "targetLight" и добавляем новые контролы этих источников в виртуальное устройство.
     *          Сразу при добавлении считываем текущее состояние реле. forceDefault обязателен.
     *          Так при обновлении правил новые виртуальные контролы перезагружаются с правильными состояния физических реле.
     */
    defineRule(name + '_rebootRule', {
        asSoonAs: function() {
            return firstStartRule;
        },
        then: function () {
            log.warning('[' + title + ']: Перезагрузка модуля'); 

            if ( targetButton.length > 0 ) {
                targetButton.forEach( function (item, index, arr) {
                    var itemType = "";
                    switch( typeof dev[item] ) {
                        case 'boolean':
                            itemType = "switch";
                        break;
                        case 'number':
                            itemType = "value";
                        break;
                    }

                    getDevice(name).addControl( "Button_" + index , { 
                        title: item, 
                        type: itemType, 
                        value: dev[item], 
                        readonly: true,
                        forceDefault: true
                    });   
                    if ( dev[buttonError[index]] !== undefined ) {
                        dev[name]["Button_" + index + '#error'] = dev[buttonError[index]];
                    }             
                });
            } else {
                getDevice(name).addControl( "ButtonAlarm", { 
                    title: "Отсутствует физическое управление", 
                    type: "alarm", 
                    value: true
                });   
            }

            var flagON = false;
            targetLight.forEach( function (item, index, arr) {
                getDevice(name).addControl( "light_" + index , { 
                    title: item, 
                    type: "switch", 
                    value: dev[item], 
                    readonly: false,
                    forceDefault: true
                });
                flagON = dev[item];
                if ( dev[lightError[index]] !== undefined ) {
                    dev[name]["light_" + index + '#error'] = dev[lightError[index]];
                }
            });
            dev[name]['qtyLight'] = targetLight.length;
            dev[name]['qtyButton'] = targetButton.length;
            dev[name]['stateGroup'] = flagON;



            // Если указали датчики движения, то создаем нужные контролы
            if ( targetMotion ) {
                getDevice(name).addControl( "motion" , { 
                    title: "Присутствие в зоне", 
                    type: "switch", 
                    value: false, 
                    readonly: true
                });
                getDevice(name).addControl( "motionLightON" , { 
                    title: "Включать свет при начале движения", 
                    type: "switch", 
                    value: false, 
                    readonly: false
                });
                getDevice(name).addControl( "timeout" , { 
                    title: "Таймаут отключения света, мин.", 
                    type: "range", 
                    value: 10, 
                    readonly: false,
                    min: 1,
                    max: 20
                });
                getDevice(name).addControl( "sensitivity" , { 
                    title: "Чувствительность датчика", 
                    type: "range", 
                    value: 35, 
                    readonly: false,
                    min: 1,
                    max: 500
                });

                targetMotion.forEach( function(item, index, arr) {
                    getDevice(name).addControl( "motion_" + index , { 
                        title: item, 
                        type: "value", 
                        value: dev[item], 
                        readonly: true,
                        forceDefault: true
                    });
                    if ( dev[motionError[index]] !== undefined ) {
                        dev[name]["motion_" + index + "#error"] = dev[motionError[index]];
                    }
                });
            }
        }
    });


    /**
     * @brief   Правило отслеживает нажатие виртуальной кнопки "button".
     *          -   Включение или отключение основывается на виртуальном контроле
     *              "stateGroup". Если группа включена, то все отключаем и наоборот.
     *          -   Если это мастер-выключатель, то перед отключением запоминает 
     *              состояние реле в энергонезависимую память.
     */
    defineRule(name + '_clickButtonVirtual', {
        whenChanged: name + '/button',
        then: function () {   
            targetLight.forEach( function (item,index) {
                if ( master ) {
                    // Если это мастер-выключатель, то перед отключением запоминаем состояние
                    if ( dev[name]['stateGroup'] ) {
                        ps[item] = dev[item];
                        dev[item] = false;
                    } else {
                        dev[item] = ps[item];
                    }

                } else {
                    // Если просто выключатель, то инверируем реле согласно состоянию группы
                    dev[item] = !dev[name]['stateGroup'];
                }
            });         
        }
    });

    // Отслеживаем нажатие физической кнопки
    defineRule(name + '_clickButtonPhysical', {
        whenChanged: targetButton,
        then: function () {
            dev[name]['button'] = true;
            targetButton.forEach( function (item, index, arr) {
                getDevice(name).getControl( 'Button_' + index ).setValue( dev[item] );
                if ( dev[buttonError[index]] !== undefined ) {
                    getDevice(name).getControl( 'Button_' + index ).setError( dev[buttonError[index]] );
                }                
            });
        }
    });


    // Отслеживаем изменение переключений физических реле и записываем в контролы для визуализации
    defineRule(name + '_releChange', {
        whenChanged:  targetLight,
        then: function () {
            var flagON = false;
            targetLight.forEach( function (item, index, arr) {
                // Тут визуально изменяем контрол для наглядности
                getDevice(name).getControl( 'light_' + index ).setValue( dev[item] );
                // Если хоть одна группа включена, то взводим флаг
                if ( dev[item] ) flagON = true;
                if ( dev[lightError[index]] !== undefined ) {
                    getDevice(name).getControl( 'light_' + index ).setError( dev[lightError[index]] );
                }
            });
            dev[name]['stateGroup'] = flagON;

            if ( targetMotion ) {
                if (idTimer) clearTimeout(idTimer);
                if ( dev[name]['stateGroup'] ) {
                    idTimer = startTimer();
                }
            }
        }
    });





    // Отслеживаем изменение датчиков движения, если они есть
    if ( targetMotion ) {

        var idTimer = null;            // Таймер для отключения света
        var idTimoutMotion = null;     // Таймер для задержки отключения контрола "motion"


        // Создаем функцию, которая создает таймер для отключения света по таймауту "timeout"
        function startTimer() {
            return setTimeout(function () {
                if ( dev[name]['stateGroup'] ) {
                    dev[name]['button'] = true;
                    log.debug('[' + title + ']: Выключение по таймауту ' + dev[name]['timeout'] + ' мин. ');
                }
                idTimer = null;
                
            }, dev[name]['timeout'] * 1000 * 60 ); //
        }

        // Создаем функцию задержки для отключения контрола "motion" ( 10 секунд )
        function startTimeoutMotion() {
            return setTimeout(function () {
                dev[name]['motion'] = false;
                idTimoutMotion = null;
                log.debug('[' + title + ']: Движение прекратилось');
            }, 10 * 1000); // 
        }




        // Правило отслеживает изменение датчиков движения
        defineRule(name + '_motionChange', {
            whenChanged: targetMotion,
            then: function (newValue, devName, cellName) {
                var move = false;

                
                
                targetMotion.forEach(function (item, index, arr) {

                    if ( dev[motionError[index]] !== undefined ) {
                        getDevice(name).getControl( 'motion_' + index ).setError( dev[motionError[index]] );
                    } else {
                        // Изменяем виртуальный контрол для наглядности
                        getDevice(name).getControl( 'motion_' + index ).setValue( dev[item] );

                        // Если хоть один датчик выдал значение больше уставки, то значит появилось движение
                        if ( dev[item] > dev[name]['sensitivity'] ) move = true;
                    }
                });

                if ( move ) {
                    dev[name]['motion'] = true;

                    // Очищаем и взводим по новой таймер на задержку отключения контрола "motion"
                    if ( idTimoutMotion ) clearTimeout( idTimoutMotion );
                    idTimoutMotion = startTimeoutMotion();

                    // Если таймер на отключения света взведен, то отключаем его при появлении движения
                    if ( idTimer ) clearTimeout( idTimer );
                }
            }
        });

        // Правило для отслеживания начала движения
        defineRule(name + '_motionON', {
            asSoonAs: function() {
                return dev[name]['motion'];
            },
            then: function () {
                // Если активно включение света при начале движения
                if ( dev[name]['motionLightON'] ) {
                    if ( !dev[name]['stateGroup'] ) {
                        dev[name]['button'] = true;
                    }
                }
            }
        });

        // Правило для отслеживания прекращения движения
        defineRule(name + '_motionOFF', {
            asSoonAs: function() {
                return !dev[name]['motion'];
            },
            then: function () {
                if (idTimer) clearTimeout(idTimer);
                idTimer = startTimer();
            }
        });
    }


}



/**
 * @brief   Функция создания виртуального устройства.
 *          В дальнейшем к этому устройству добавляются дополнительные контролы
 * @param {String}  title   Описание виртуального устройства (Можно на русском)
 * @param {String}  name    Имя виртуального устройства (Будет отображаться в новом виртуальном кстройстве как name/... )
 */
function createVirtualDevice( title , name ) {
    defineVirtualDevice( name, {
        title: title,
        cells: {
            // Здесь только отображаем общее состояние группы.
            // Если хоть одно реле включено, то true ( смотри правило "_releChange" )
            stateGroup: {
                title: 'Состояние группы',
                type: "switch",
                value: false,
                readonly: true
            },
            // Виртуальная кнопка для управления группой реле
            button: {
                title: 'Вкл/Выкл группу',
                type: "pushbutton",
            },
            // Тут просто выводим общее кол-во реле в группе
            qtyLight: {
                title: 'Кол-во групп света',
                type: "value",
                value: 0,
                readonly: true
            },
            // Тут просто выводим общее кол-во физических кнопок
            qtyButton: {
                title: 'Кол-во выключателей',
                type: "value",
                value: 0,
                readonly: true
            }
        }
    });
}


/**
 * @brief   Функция создает правило для слежения за meta #error
 * 
 * @param {*} targetError Массив на список устройств с meta #error
 * @param {*} device  Имя устройства
 * @param {*} control Контрол устройства
 */
function createErrorRule( targetError , device , control ) {
    defineRule(device + '_' + control + 'Error', {
        whenChanged:  targetError,
        then: function () {
            targetError.forEach( function (item, index, arr) {
                // Тут визуально изменяем контрол для наглядности
                var err = dev[item];
                if ( err == undefined ) err = '';
                getDevice(device).getControl( control + index ).setError( err );
            });
        }
    });
}


/**
 * @brief   Функция перебирает массив устройств и добавляет существующие
 *          устройства в новые массивы, с которым в дальнейшем работает главная 
 *          функция
 * @param {*} source        Массив источник физических устройств
 * @param {*} target        Массив, в который добавятся только существующие устройства
 * @param {*} targetError   Массив с meta #error для существующих устройств
 */
function reloadDeviceArray( source , target , targetError ) {
    if ( source.constructor === Array ) {
        source.forEach( function (item, index, arr) {
            if ( deviceExists(item) ) {
                targetError.push( item + "#error" );
                target.push( item );
            }
        });
    } else {
        if ( deviceExists(source) ) {
            targetError.push( source + "#error" );
            target.push( source );
        }        
    }
}

/**
 * @brief   Функция проверяет на существование устройства и его контрола.
 * 
 * @param {String} topic Топик для проверки типа "device/topic"
 */
function deviceExists( topic ) {

    var device  = topic.split('/')[0];
    var control = topic.split('/')[1];
    var exists = false;

    if ( getDevice(device) !== undefined ) {
        if ( getDevice(device).isControlExists(control) ) {
            // Устройство и контрол существуют, можно работать с данным топиком
            exists = true;
        } else {
            log.error("[{}] У устройства {} отсутствует контрол {}", module.filename , device , control);
        }
    } else {
        log.error("[{}] {} - данное устройство отсутствует в системе", module.filename , device);
    }

    return exists;
}

exports.createLightingGroup  = function( title , name , Button , Light , master , Motion ) {
    createLightingGroup ( title , name , Button , Light , master , Motion );
} 